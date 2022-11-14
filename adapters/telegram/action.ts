import {
    Action,
    AllResps,
    ensureDir,
    base64Decode,
    contentType,
    base64Encode,
    basename,
    extname
} from '../../deps.ts'
import * as TelegramType from './types/index.ts'
import { onebot2telegram } from './seg.ts'
import { VERSION } from '../../version.ts'
import { uint8ArrayToHexString } from '../../utils.ts'
import { Telegram } from './mod.ts'

export class ActionHandler {
    constructor(private tg: Telegram, private internal: TelegramType.Internal) {
    }
    getSupportedActions(data: Action): AllResps {
        if (data.action == 'send_message') { data.params.channel_id }
        return {
            status: "ok",
            retcode: 0,
            data: Object.keys(this.tg.support_action),
            message: "",
            echo: data.echo ? data.echo : "",
        }
    }
    getStatus(data: Action): AllResps {
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
    getVersion(data: Action): AllResps {
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
    async sendMessage(data: Action<'send_message'>): Promise<AllResps> {
        const chat_id = data.params.user_id || data.params.group_id
        const [payload, method] = await onebot2telegram(data.params.message)
        let all_payload
        if (payload instanceof FormData) {
            payload.append('chat_id', chat_id!)
            all_payload = payload
        } else {
            all_payload = { chat_id, ...payload }
        }
        try {
            // deno-lint-ignore no-explicit-any
            const result = await this.internal[method](all_payload as any)
            return {
                status: 'ok',
                retcode: 0,
                data: {
                    message_id: `${chat_id}/${result.message_id}`,
                    time: result.date!
                },
                message: ''
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async deleteMessage(data: Action<'delete_message'>): Promise<AllResps> {
        const target = data.params.message_id.split('/')
        try {
            await this.internal.deleteMessage({
                chat_id: target[0],
                message_id: parseInt(target[1])
            })
            return default_success_resp(data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getSelfInfo(data: Action<'get_self_info'>): Promise<AllResps> {
        try {
            const result = await this.internal.getMe()
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
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getUserInfo(data: Action<'get_user_info'>): Promise<AllResps> {
        try {
            const result = await this.internal.getChat({
                chat_id: data.params.user_id
            })
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
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupInfo(data: Action<'get_group_info'>): Promise<AllResps> {
        try {
            const result = await this.internal.getChat({
                chat_id: data.params.group_id
            })
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
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupMemberInfo(data: Action<'get_group_member_info'>): Promise<AllResps> {
        try {
            const result = await this.internal.getChatMember({
                chat_id: data.params.group_id,
                user_id: parseInt(data.params.user_id)
            })
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
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async setGroupName(data: Action<'set_group_name'>): Promise<AllResps> {
        try {
            await this.internal.SetChatTitle({
                chat_id: data.params.group_id,
                title: data.params.group_name
            })
            return default_success_resp(data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async leaveGroup(data: Action<'leave_group'>): Promise<AllResps> {
        try {
            await this.internal.LeaveChat({
                chat_id: data.params.group_id
            })
            return default_success_resp(data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async uploadFile(data: Action<'upload_file'>): Promise<AllResps> {
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
    async uploadFileFragmented(data: Action<'upload_file_fragmented'>): Promise<AllResps> {
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
    async getFile(data: Action<'get_file'>, send_msgpack: boolean): Promise<AllResps> {
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
                        const result = await this.internal.getFile({
                            file_id: target[1]
                        })
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
                    break
                }
                case 'path': {
                    if (target[0] === 'tg') {
                        const result = await this.internal.getFile({
                            file_id: target[1]
                        })
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
                        const result = await this.internal.getFile({
                            file_id: target[1]
                        })
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
    async getFileFragmented(data: Action<'get_file_fragmented'>, send_msgpack: boolean): Promise<AllResps> {
        try {
            const target = data.params.file_id.split('/')
            switch (data.params.stage) {
                case 'prepare':
                    if (target[0] === 'tg') {
                        const result = await this.internal.getFile({
                            file_id: target[1]
                        })
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

function empty_fail_resp(retcode: number, message: string, echo: string | undefined): AllResps {
    return {
        status: 'failed',
        data: null,
        retcode,
        message,
        echo: echo ? echo : '',
    }
}

function default_fail_resp(echo: string | undefined): AllResps {
    return {
        status: 'failed',
        data: null,
        retcode: 36000,
        message: '我不想干了',
        echo: echo ? echo : '',
    }
}

function default_success_resp(echo: string | undefined): AllResps {
    return {
        status: 'ok',
        data: null,
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    }
}

/*function not_executed_fail_resp(echo: string | undefined, description: string): AllResps {
    return {
        status: 'failed',
        retcode: 34000,
        data: null,
        message: `机器人平台未执行此操作: "${description}"`,
        echo: echo ? echo : '',
    }
}*/

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
        echo: echo ? echo : '',
    }
}