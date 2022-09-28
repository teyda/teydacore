import {
    AllActions,
    MetaResps,
    OneBot,
    OneBotConfig,
    UserMessageEvents,
    GroupMessageEvents,
    MetaEvents,
    MessageResps,
    ActionsDetail
} from '../../deps.ts'
import { Adapter, AdapterConfig } from "../../adapter.ts"
import { Update, MessageEntity, Message } from './types/index.ts'
import { parseSegment, TelegramMessageSegments } from './seg.ts'
import { VERSION } from '../../version.ts'

export class Telegram extends Adapter {
    private ob: OneBot
    private running = false
    private online = false
    private offset = 0
    private support_action = ['get_supported_actions', 'get_status', 'get_version', 'send_message']
    constructor(public config: TelegramConfig) {
        super()
        this.ob = new OneBot(async (data) => {
            switch (data.action) {
                case 'get_supported_actions': {
                    return this.get_supported_actions(data)
                }
                case 'get_status': {
                    return this.get_status(data)
                }
                case 'get_version': {
                    return this.get_version(data)
                }
                case 'send_message': {
                    return await this.send_message(data)
                }
                default:
                    return {
                        status: "failed",
                        retcode: 10002,
                        data: null,
                        message: "不支持的动作请求",
                        echo: data.echo ? data.echo : "",
                    }
            }
        })
    }
    private get_supported_actions(data: AllActions): MetaResps {
        return {
            status: "ok",
            retcode: 0,
            data: Object.keys(this.support_action),
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    private get_status(data: AllActions): MetaResps {
        return {
            status: "ok",
            retcode: 0,
            data: {
                good: this.online && this.running,
                bots: [{
                    self: {
                        platform: 'telegram',
                        user_id: this.config.self_id
                    },
                    online: this.online
                }]
            },
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    private get_version(data: AllActions): MetaResps {
        return {
            status: "ok",
            retcode: 0,
            data: {
                impl: 'teyda',
                version: VERSION,
                onebot_version: '12'
            },
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    private async send_message(data: ActionsDetail.SendMessage<TelegramMessageSegments>): Promise<MessageResps> {
        let method = 'sendMessage'
        const chat_id = data.params.user_id || data.params.group_id
        const payload: Record<string, unknown> = {
            chat_id
        }
        const excludeReply = data.params.message.filter(element => {
            switch (element.type) {
                case 'reply': {
                    payload.reply_to_message_id = parseInt(element.data.message_id)
                    break
                }
                case 'image': {
                    method = 'sendPhoto'
                    payload.photo = element.data.file_id
                    break
                }
                case 'file': {
                    method = 'sendDocument'
                    payload.document = element.data.file_id
                    break
                }
                case 'telegram.animation': {
                    method = 'sendAnimation'
                    payload.animation = element.data.file_id
                    break
                }
                case 'audio': {
                    method = 'sendAudio'
                    payload.audio = element.data.file_id
                    break
                }
                case 'video': {
                    method = 'sendVideo'
                    payload.video = element.data.file_id
                    break
                }
                case 'voice': {
                    method = 'sendVoice'
                    payload.voice = element.data.file_id
                    break
                }
                case 'location': {
                    method = 'sendLocation'
                    payload.latitude = element.data.latitude
                    payload.longitude = element.data.longitude
                    break
                }
                case 'telegram.sticker': {
                    method = 'sendSticker'
                    payload.sticker = element.data.file_id
                    break
                }
                default:
                    return element
            }
        })
        let text_parsed = ""
        const entities: MessageEntity[] = []
        let offset = 0
        for (const seg of excludeReply) {
            switch (seg.type) {
                case 'mention': {
                    const length = seg.data['telegram.text'].length
                    text_parsed = text_parsed + seg.data['telegram.text']
                    offset = offset + length
                    entities.push({
                        type: 'mention',
                        offset: offset,
                        length
                    })
                    break
                }
                case 'text': {
                    text_parsed = text_parsed + seg.data.text
                    offset = offset + seg.data.text.length
                    break
                }
                default:
                    return {
                        status: 'failed',
                        retcode: 10005,
                        data: null,
                        message: 'OneBot 实现没有实现该消息段类型'
                    }
            }
        }
        text_parsed !== '' && (payload.text = text_parsed)
        const res = await fetch(
            `https://api.telegram.org/bot${this.config.token}/${method}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        )
        const tg_resp = await res.json()
        if (tg_resp.ok) {
            const result: Message = tg_resp.result
            return {
                status: 'ok',
                retcode: 0,
                data: {
                    message_id: `${chat_id}/${result.message_id}`,
                    time: result.date!
                },
                message: ''
            }
        }
        return {
            status: 'failed',
            retcode: 34000,
            data: null,
            message: `机器人平台未执行此操作: "${tg_resp.description}"`
        }
    }
    public start() {
        this.running = true
        this.ob.start({
            basic: {
                onebot_version: 12,
                impl: "teyda",
            },
            ...this.config.connect,
        })
        const get_updates = async () => {
            try {
                const res = await fetch(
                    `https://api.telegram.org/bot${this.config.token}/getUpdates`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            timeout: 60000,
                            offset: this.offset + 1,
                        }),
                    },
                )
                const data = await res.json()
                if (data.ok) {
                    for (const update of data.result) {
                        this.offset = Math.max(this.offset, update.update_id)
                        console.log(update)
                        this.telegram_to_onebot(update)
                    }
                    this.change_online(true)
                } else {
                    this.change_online(false)
                }
                get_updates();
            } catch (_err) {
                this.change_online(false)
                setTimeout(get_updates, 500);
            }
        }
        get_updates()
    }
    private change_online(bool: boolean): void {
        if (bool === this.online) return
        this.online = bool
        const event: MetaEvents = {
            id: crypto.randomUUID(),
            time: new Date().getTime() / 1000,
            type: 'meta',
            detail_type: 'status_update',
            sub_type: '',
            status: {
                good: this.online && this.running,
                bots: [{
                    self: {
                        platform: 'telegram',
                        user_id: this.config.self_id
                    },
                    online: this.online
                }]
            }
        }
        this.ob.send(event)
    }
    private telegram_to_onebot(e: Update): void {
        if (e.message) {
            switch (e.message.chat?.type) {
                case 'private': {
                    const event: UserMessageEvents = {
                        id: crypto.randomUUID(),
                        self: {
                            platform: 'telegram',
                            user_id: this.config.self_id
                        },
                        time: e.message.date!,
                        type: 'message',
                        detail_type: 'private',
                        sub_type: '',
                        message_id: `${e.message.chat.id}/${e.message.message_id}`,
                        message: parseSegment(e.message),
                        alt_message: e.message.text!,
                        user_id: e.message.from?.id?.toString()!
                    }
                    this.ob.send(event)
                    break
                }
                case 'supergroup':
                case 'group': {
                    const event: GroupMessageEvents = {
                        id: crypto.randomUUID(),
                        self: {
                            platform: 'telegram',
                            user_id: this.config.self_id
                        },
                        time: e.message.date!,
                        type: 'message',
                        detail_type: 'group',
                        sub_type: '',
                        message_id: `${e.message.chat.id}/${e.message.message_id}`,
                        message: parseSegment(e.message),
                        alt_message: e.message.text!,
                        user_id: e.message.from?.id?.toString()!,
                        group_id: e.message.chat.id?.toString()!
                    }
                    this.ob.send(event)
                    break
                }
            }
        }
    }
    public stop() {
        this.running = false
        this.ob.shutdown()
    }
}

export interface TelegramConfig extends AdapterConfig {
    token: string
    connect: {
        ws?: OneBotConfig["ws"]
        wsr?: OneBotConfig["wsr"]
    }
}
