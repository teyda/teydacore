import {
    OneBot,
    MetaEvents,
    OneBotConfig,
} from '../../deps.ts'
import { Adapter } from "../../adapter.ts"
import * as TelegramType from './types/index.ts'
import { ActionHandler } from './action.ts'
import { AdapterConfig } from "../../adapter.ts"
import { EventHandler } from './event.ts'

export interface TelegramConfig extends AdapterConfig {
    token: string
    connect: {
        ws?: OneBotConfig["ws"]
        wsr?: OneBotConfig["wsr"]
    }
}

export class Telegram extends Adapter<TelegramConfig> {
    private ob: OneBot
    public running = false
    public online = false
    private _offset = 0
    public readonly support_action = ['get_supported_actions', 'get_status', 'get_version', 'send_message', 'delete_message', 'get_self_info', 'get_user_info', 'get_group_info', 'get_group_member_info', 'set_group_name', 'leave_group', 'upload_file', 'upload_file_fragmented', 'get_file', 'get_file_fragmented']
    private internal: TelegramType.Internal
    private ah: ActionHandler
    private eh: EventHandler
    public info: TelegramType.User | undefined
    constructor(config: TelegramConfig) {
        super(config)
        this.internal = new TelegramType.Internal(`https://api.telegram.org/bot${this.config.token}`)
        this.ah = new ActionHandler(this, this.internal)
        this.eh = new EventHandler(this, this.internal)
        this.ob = new OneBot(async (data, send_msgpack) => {
            switch (data.action) {
                case 'get_supported_actions':
                    return this.ah.getSupportedActions(data)
                case 'get_status':
                    return this.ah.getStatus(data)
                case 'get_version':
                    return this.ah.getVersion(data)
                case 'send_message':
                    return await this.ah.sendMessage(data)
                case 'delete_message':
                    return await this.ah.deleteMessage(data)
                case 'get_self_info':
                    return await this.ah.getSelfInfo(data)
                case 'get_user_info':
                    return await this.ah.getUserInfo(data)
                case 'get_group_info':
                    return await this.ah.getGroupInfo(data)
                case 'get_group_member_info':
                    return await this.ah.getGroupMemberInfo(data)
                case 'set_group_name':
                    return await this.ah.setGroupName(data)
                case 'leave_group':
                    return await this.ah.leaveGroup(data)
                case 'upload_file':
                    return await this.ah.uploadFile(data)
                case 'upload_file_fragmented':
                    return await this.ah.uploadFileFragmented(data)
                case 'get_file':
                    return await this.ah.getFile(data, send_msgpack)
                case 'get_file_fragmented':
                    return await this.ah.getFileFragmented(data, send_msgpack)
                default:
                    return {
                        status: 'failed',
                        data: null,
                        retcode: 10002,
                        message: '不支持的动作请求',
                        echo: data.echo,
                    }
            }
        })
    }
    private polling() {
        const get_updates = () => {
            this.internal.getUpdates({
                timeout: 60000,
                offset: this._offset + 1,
            }).then(data => {
                for (const update of data) {
                    this._offset = Math.max(this._offset, update.update_id!)
                    console.log(update)
                    this.telegram2onebot(update)
                }
                this.change_online(true)
                get_updates()
            }).catch(() => {
                this.change_online(false)
                setTimeout(get_updates, 500)
            })
        }
        get_updates()
    }
    public start() {
        const get_me = () => {
            this.internal.getMe().then(data => {
                this.info = data
                this.running = true
                this.ob.start({
                    basic: {
                        onebot_version: 12,
                        impl: "teyda",
                    },
                    ...this.config.connect,
                })
                this.polling()
            }).catch(() => {
                setTimeout(get_me, 500)
            })
        }
        get_me()
    }
    private change_online(bool: boolean) {
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
                        user_id: this.info?.id?.toString()!
                    },
                    online: this.online
                }]
            }
        }
        this.ob.send(event)
    }
    private telegram2onebot(e: TelegramType.Update) {
        if (e.message) {
            if (e.message.text || e.message.location || e.message.photo || e.message.sticker || e.message.animation || e.message.voice || e.message.video || e.message.document || e.message.audio) {
                let payload
                switch (e.message.chat?.type) {
                    case 'private': {
                        payload = this.eh.message.private(e.message)
                        break
                    }
                    case 'supergroup':
                    case 'group': {
                        payload = this.eh.message.group(e.message)
                        break
                    }
                }
                payload && this.ob.send(payload)
            } else if (e.message.new_chat_members) {
                for (const member of e.message.new_chat_members) {
                    this.ob.send(this.eh.notice.groupMemberIncrease(member, e.message.date!))
                }
            }
        } else if (e.my_chat_member) {
            const payload = e.my_chat_member.new_chat_member?.status === 'member' ? this.eh.notice.friendIncrease(e.my_chat_member) : this.eh.notice.friendDecrease(e.my_chat_member)
            this.ob.send(payload)
        }
    }
    public stop() {
        this.running = false
        this.ob.shutdown()
    }
}