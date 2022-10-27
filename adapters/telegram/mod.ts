import {
    AllActions,
    OneBot,
    OneBotConfig,
    UserMessageEvents,
    GroupMessageEvents,
    MetaEvents,
    ActionsDetail,
    AllResps,
    ensureDir,
    base64Decode,
    contentType,
    base64Encode,
    basename,
    extname
} from '../../deps.ts'
import { Adapter, AdapterConfig } from "../../adapter.ts"
import * as TelegramType from './types/index.ts'
import { parseSegment, TelegramMessageSegments } from './seg.ts'
import { VERSION } from '../../version.ts'
import { uint8ArrayToHexString } from '../../utils.ts'

export class Telegram extends Adapter {
    private ob: OneBot
    public running = false
    public online = false
    private offset = 0
    public readonly support_action = ['get_supported_actions', 'get_status', 'get_version', 'send_message', 'delete_message', 'get_self_info', 'get_user_info', 'get_group_info', 'get_group_member_info', 'set_group_name', 'leave_group', 'upload_file', 'upload_file_fragmented', 'get_file', 'get_file_fragmented']
    private ah = new ActionHandler(this)
    public info: TelegramType.User | undefined
    constructor(public readonly config: TelegramConfig) {
        super()
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
                    return empty_fail_resp(10002, '不支持的动作请求', data.echo)
            }
        })
    }
    private async polling() {
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
            this.polling()
        } catch {
            this.change_online(false)
            setTimeout(this.polling, 500);
        }
    }
    public async start() {
        try {
            const res = await fetch(`https://api.telegram.org/bot${this.config.token}/getMe`)
            const data = await res.json()
            if (data.ok) {
                this.info = data.result
                this.running = true
                this.ob.start({
                    basic: {
                        onebot_version: 12,
                        impl: "teyda",
                    },
                    ...this.config.connect,
                })
                this.polling()
            }
        } catch {
            setTimeout(this.start, 500)
        }
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
                        user_id: this.info?.id?.toString()!
                    },
                    online: this.online
                }]
            }
        }
        this.ob.send(event)
    }
    private telegram_to_onebot(e: TelegramType.Update): void {
        if (e.message) {
            switch (e.message.chat?.type) {
                case 'private': {
                    const event: UserMessageEvents = {
                        id: crypto.randomUUID(),
                        self: {
                            platform: 'telegram',
                            user_id: this.info?.id?.toString()!
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
                            user_id: this.info?.id?.toString()!
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

class ActionHandler {
    constructor(private tg: Telegram) {
    }
    getSupportedActions(data: AllActions): AllResps {
        return {
            status: "ok",
            retcode: 0,
            data: Object.keys(this.tg.support_action),
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    getStatus(data: AllActions): AllResps {
        return {
            status: "ok",
            retcode: 0,
            data: {
                good: this.tg.online && this.tg.running,
                bots: [{
                    self: {
                        platform: 'telegram',
                        user_id: this.tg.info?.id?.toString()!
                    },
                    online: this.tg.online
                }]
            },
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    getVersion(data: AllActions): AllResps {
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
    async sendMessage(data: ActionsDetail.SendMessage<TelegramMessageSegments>): Promise<AllResps> {
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
        const entities: TelegramType.MessageEntity[] = []
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
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/${method}`,
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
                const result: TelegramType.Message = tg_resp.result
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
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async deleteMessage(data: ActionsDetail.DeleteMessage): Promise<AllResps> {
        const target = data.params.message_id.split('/')
        const payload: TelegramType.DeleteMessagePayload = {
            chat_id: target[0],
            message_id: parseInt(target[1])
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/deleteMessage`,
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
                return default_success_resp(data.echo)
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getSelfInfo(data: AllActions): Promise<AllResps> {
        try {
            const res = await fetch(`https://api.telegram.org/bot${this.tg.config.token}/getMe`)
            const tg_resp = await res.json()
            if (tg_resp.ok) {
                const result: TelegramType.User = tg_resp.result
                return {
                    status: 'ok',
                    data: {
                        user_id: result.id?.toString()!,
                        user_name: result.username!,
                        user_displayname: result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name!
                    },
                    retcode: 0,
                    message: '',
                    echo: data.echo ? data.echo : "",
                }
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getUserInfo(data: ActionsDetail.GetUserInfo): Promise<AllResps> {
        const payload: TelegramType.GetChatPayload = {
            chat_id: data.params.user_id
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/getChat`,
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
                const result: TelegramType.Chat = tg_resp.result
                return {
                    status: 'ok',
                    data: {
                        user_id: result.id?.toString()!,
                        user_name: result.username!,
                        user_displayname: result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name!,
                        user_remark: ''
                    },
                    retcode: 0,
                    message: '',
                    echo: data.echo ? data.echo : "",
                }
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupInfo(data: ActionsDetail.GetGroupInfo): Promise<AllResps> {
        const payload: TelegramType.GetChatPayload = {
            chat_id: data.params.group_id
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/getChat`,
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
                const result: TelegramType.Chat = tg_resp.result
                return {
                    status: 'ok',
                    data: {
                        group_id: result.id?.toString()!,
                        group_name: result.title!
                    },
                    retcode: 0,
                    message: '',
                    echo: data.echo ? data.echo : "",
                }
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupMemberInfo(data: ActionsDetail.GetGroupMemberInfo): Promise<AllResps> {
        const payload: TelegramType.GetChatMemberPayload = {
            chat_id: data.params.group_id,
            user_id: parseInt(data.params.user_id)
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/getChatMember`,
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
                const result: TelegramType.ChatMember = tg_resp.result
                return {
                    status: 'ok',
                    data: {
                        user_id: result.user?.id?.toString()!,
                        user_name: result.user?.username!,
                        user_displayname: result.user?.last_name ? `${result.user?.first_name} ${result.user?.last_name}` : result.user?.first_name!,
                    },
                    retcode: 0,
                    message: '',
                    echo: data.echo ? data.echo : "",
                }
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async setGroupName(data: ActionsDetail.SetGroupName): Promise<AllResps> {
        const payload: TelegramType.SetChatTitlePayload = {
            chat_id: data.params.group_id,
            title: data.params.group_name
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/setChatTitle`,
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
                return default_success_resp(data.echo)
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async leaveGroup(data: ActionsDetail.LeaveGroup): Promise<AllResps> {
        const payload: TelegramType.LeaveChatPayload = {
            chat_id: data.params.group_id
        }
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.tg.config.token}/leaveChat`,
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
                return default_success_resp(data.echo)
            }
            return not_executed_fail_resp(data.echo, tg_resp.description)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async uploadFile(data: ActionsDetail.UploadFile): Promise<AllResps> {
        try {
            switch (data.params.type) {
                case 'url': {
                    const res = await fetch(data.params.url!, {
                        headers: data.params.headers ? data.params.headers : {}
                    })
                    const buf = await res.arrayBuffer()
                    return await saveFile(buf, data.params.name, data.params.sha256, data.echo)
                }
                case 'path': {
                    const res = await Deno.readFile(data.params.path!)
                    return await saveFile(res.buffer, data.params.name, data.params.sha256, data.echo)
                }
                case 'data': {
                    if (typeof data.params.data === 'string') {
                        const res = base64Decode(data.params.data!)
                        return await saveFile(res.buffer, data.params.name, data.params.sha256, data.echo)
                    }
                    return await saveFile(data.params.data!, data.params.name, data.params.sha256, data.echo)
                }
                default:
                    return default_fail_resp(data.echo)
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async uploadFileFragmented(data: ActionsDetail.UploadFileFragmentedFinish | ActionsDetail.UploadFileFragmentedPrepare | ActionsDetail.UploadFileFragmentedTransfer): Promise<AllResps> {
        try {
            switch (data.params.stage) {
                case 'prepare': {
                    await ensureDir('./teyda_data')
                    const file_name = `temp_${data.params.name}`
                    const file = await Deno.open(`./teyda_data/${file_name}`, { read: true, write: true, create: true })
                    await Deno.ftruncate(file.rid, data.params.total_size)
                    file.close()
                    return {
                        status: 'ok',
                        data: {
                            file_id: `td/${file_name}`
                        },
                        retcode: 0,
                        message: '',
                        echo: data.echo ? data.echo : '',
                    }
                }
                case 'transfer': {
                    const target = data.params.file_id.split('/')
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (!file_info.isFile) {
                        return empty_fail_resp(32002, 'file_id 错误', data.echo)
                    }
                    const file = await Deno.open(`./teyda_data/${target[1]}`, { read: true, write: true })
                    await file.seek(data.params.offset, 0)
                    if (typeof data.params.data === 'string') {
                        await file.write(base64Decode(data.params.data))
                    } else {
                        await file.write(new Uint8Array(data.params.data))
                    }
                    file.close()
                    return default_success_resp(data.echo)
                }
                case 'finish': {
                    const target = data.params.file_id.split('/')
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (!file_info.isFile) {
                        return empty_fail_resp(32002, 'file_id 错误', data.echo)
                    }
                    const res = await Deno.readFile(`./teyda_data/${target[1]}`)
                    const digest = await crypto.subtle.digest("SHA-256", res.buffer)
                    const hash = uint8ArrayToHexString(new Uint8Array(digest))
                    if (hash !== data.params.sha256) {
                        return empty_fail_resp(32001, 'SHA-256 hash 不匹配', data.echo)
                    }
                    const file_name = target[1].replace('temp_', '')
                    await Deno.rename(`./teyda_data/${target[1]}`, `./teyda_data/${file_name}`)
                    return {
                        status: 'ok',
                        data: {
                            file_id: `td/${file_name}`
                        },
                        retcode: 0,
                        message: '',
                        echo: data.echo ? data.echo : '',
                    }
                }
                default:
                    return default_fail_resp(data.echo)
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getFile(data: ActionsDetail.GetFile, send_msgpack: boolean): Promise<AllResps> {
        try {
            const target = data.params.file_id.split('/')
            switch (data.params.type) {
                case 'url': {
                    if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return {
                            status: 'ok',
                            data: {
                                name: target[1],
                                sha256,
                                url: `data:${contentType(target[1])};base64,${base64Encode(file_data.buffer)}`
                            },
                            retcode: 0,
                            message: '',
                            echo: data.echo ? data.echo : "",
                        }
                    } else if (target[0] === 'tg') {
                        const res = await fetch(`https://api.telegram.org/bot${this.tg.config.token}/getFile`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                file_id: target[1]
                            })
                        })
                        const tg_resp = await res.json()
                        if (tg_resp.ok) {
                            const result: TelegramType.File = tg_resp.result
                            const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                            const file_data = await file.arrayBuffer()
                            const digest = await crypto.subtle.digest("SHA-256", file_data)
                            const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                            const name = basename(result.file_path!)
                            return {
                                status: 'ok',
                                data: {
                                    name,
                                    sha256,
                                    url: `data:${contentType(name)};base64,${base64Encode(file_data)}`
                                },
                                retcode: 0,
                                message: '',
                                echo: data.echo ? data.echo : "",
                            }
                        }
                        return not_executed_fail_resp(data.echo, tg_resp.description)
                    }
                    break
                }
                case 'path': {
                    if (target[0] === 'tg') {
                        const res = await fetch(`https://api.telegram.org/bot${this.tg.config.token}/getFile`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                file_id: target[1]
                            })
                        })
                        const tg_resp = await res.json()
                        if (tg_resp.ok) {
                            const result: TelegramType.File = tg_resp.result
                            const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                            const file_data = await file.arrayBuffer()
                            const digest = await crypto.subtle.digest("SHA-256", file_data)
                            const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                            const name = `tg_${sha256}${extname(result.file_path!)}`
                            await ensureDir("./teyda_data")
                            await Deno.writeFile(`./teyda_data/${name}`, new Uint8Array(file_data))
                            return {
                                status: 'ok',
                                data: {
                                    name,
                                    sha256,
                                    path: await Deno.realPath(`./teyda_data/${name}`)
                                },
                                retcode: 0,
                                message: '',
                                echo: data.echo ? data.echo : "",
                            }
                        }
                        return not_executed_fail_resp(data.echo, tg_resp.description)
                    } else if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return {
                            status: 'ok',
                            data: {
                                name: target[1],
                                sha256,
                                path: await Deno.realPath(`./teyda_data/${target[1]}`)
                            },
                            retcode: 0,
                            message: '',
                            echo: data.echo ? data.echo : "",
                        }
                    }
                    break
                }
                case 'data': {
                    if (target[0] === 'tg') {
                        const res = await fetch(`https://api.telegram.org/bot${this.tg.config.token}/getFile`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                file_id: target[1]
                            })
                        })
                        const tg_resp = await res.json()
                        if (tg_resp.ok) {
                            const result: TelegramType.File = tg_resp.result
                            const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                            const file_data = await file.arrayBuffer()
                            const digest = await crypto.subtle.digest("SHA-256", file_data)
                            const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                            return {
                                status: 'ok',
                                data: {
                                    name: basename(result.file_path!),
                                    data: send_msgpack ? file_data : base64Encode(file_data),
                                    sha256
                                },
                                retcode: 0,
                                message: '',
                                echo: data.echo ? data.echo : "",
                            }
                        }
                        return not_executed_fail_resp(data.echo, tg_resp.description)
                    } else if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return {
                            status: 'ok',
                            data: {
                                name: target[1],
                                data: send_msgpack ? file_data.buffer : base64Encode(file_data.buffer),
                                sha256
                            },
                            retcode: 0,
                            message: '',
                            echo: data.echo ? data.echo : "",
                        }
                    }
                    break
                }
                default:
                    return default_fail_resp(data.echo)
            }
            return empty_fail_resp(32002, 'file_id 错误', data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getFileFragmented(data: ActionsDetail.GetFileFragmentedPrepare | ActionsDetail.GetFileFragmentedTransfer, send_msgpack: boolean): Promise<AllResps> {
        try {
            const target = data.params.file_id.split('/')
            switch (data.params.stage) {
                case 'prepare':
                    if (target[0] === 'tg') {
                        const res = await fetch(`https://api.telegram.org/bot${this.tg.config.token}/getFile`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                file_id: target[1]
                            })
                        })
                        const tg_resp = await res.json()
                        if (tg_resp.ok) {
                            const result: TelegramType.File = tg_resp.result
                            const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                            const file_data = await file.arrayBuffer()
                            const digest = await crypto.subtle.digest("SHA-256", file_data)
                            const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                            await ensureDir("./teyda_data")
                            await Deno.writeFile(`./teyda_data/${target[1]}`, new Uint8Array(file_data))
                            const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                            return {
                                status: 'ok',
                                data: {
                                    name: basename(result.file_path!),
                                    total_size: file_info.size,
                                    sha256
                                },
                                retcode: 0,
                                message: '',
                                echo: data.echo ? data.echo : "",
                            }
                        }
                        return not_executed_fail_resp(data.echo, tg_resp.description)
                    } else if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return {
                            status: 'ok',
                            data: {
                                name: target[1],
                                sha256,
                                total_size: file_info.size
                            },
                            retcode: 0,
                            message: '',
                            echo: data.echo ? data.echo : "",
                        }
                    }
                    break
                case 'transfer': {
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (!file_info.isFile) {
                        return empty_fail_resp(32002, 'file_id 错误', data.echo)
                    }
                    const file = await Deno.open(`./teyda_data/${target[1]}`, { read: true })
                    await file.seek(data.params.offset, 0)
                    const buf = new Uint8Array(data.params.size)
                    await file.read(buf)
                    file.close()
                    return {
                        status: 'ok',
                        data: {
                            data: send_msgpack ? buf.buffer : base64Encode(buf.buffer)
                        },
                        retcode: 0,
                        message: '',
                        echo: data.echo ? data.echo : "",
                    }
                }
                default:
                    return default_fail_resp(data.echo)
            }
            return empty_fail_resp(32002, 'file_id 错误', data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
}

export interface TelegramConfig extends AdapterConfig {
    token: string
    connect: {
        ws?: OneBotConfig["ws"]
        wsr?: OneBotConfig["wsr"]
    }
}

function empty_fail_resp(retcode: number, message: string, echo: string | undefined): AllResps {
    return {
        status: 'failed',
        data: null,
        retcode,
        message,
        echo: echo ? echo : "",
    }
}

function default_fail_resp(echo: string | undefined): AllResps {
    return {
        status: 'failed',
        data: null,
        retcode: 36000,
        message: '我不想干了',
        echo: echo ? echo : "",
    }
}

function default_success_resp(echo: string | undefined): AllResps {
    return {
        status: 'ok',
        data: null,
        retcode: 0,
        message: '',
        echo: echo ? echo : "",
    }
}

function not_executed_fail_resp(echo: string | undefined, description: string): AllResps {
    return {
        status: 'failed',
        retcode: 34000,
        data: null,
        message: `机器人平台未执行此操作: "${description}"`,
        echo: echo ? echo : "",
    }
}

async function saveFile(buf: ArrayBuffer, name: string, sha256: string | undefined, echo: string | undefined): Promise<AllResps> {
    if (sha256) {
        const digest = await crypto.subtle.digest("SHA-256", buf)
        const hash = uint8ArrayToHexString(new Uint8Array(digest))
        if (hash !== sha256) {
            return empty_fail_resp(32001, 'SHA-256 hash 不匹配', echo)
        }
    }
    await ensureDir("./teyda_data")
    await Deno.writeFile(`./teyda_data/${name}`, new Uint8Array(buf))
    return {
        status: 'ok',
        data: {
            file_id: `td/${name}`
        },
        retcode: 0,
        message: '',
        echo: echo ? echo : "",
    }
}