import {
    Action,
    Resp,
    ensureDir,
    base64Decode,
    contentType,
    base64Encode,
    basename,
    extname
} from '../../deps.ts'
import * as TelegramType from './types/index.ts'
import { stringify as segStringify } from './seg.ts'
import { VERSION } from '../../version.ts'
import { uint8ArrayToHexString } from '../../utils.ts'
import { Telegram } from './mod.ts'

export class ActionHandler {
    constructor(private tg: Telegram, private internal: TelegramType.Internal) {
    }
    getSupportedActions(data: Action): Resp {
        return success_resp(Object.keys(this.tg.support_action), data.echo)
    }
    getStatus(data: Action): Resp {
        return success_resp({
            good: this.tg.online && this.tg.running,
            bots: [{
                self: {
                    platform: this.tg.platform,
                    user_id: this.tg.info?.id?.toString()!
                },
                online: this.tg.online
            }]
        }, data.echo)
    }
    getVersion(data: Action): Resp {
        return success_resp({
            impl: 'teyda',
            version: VERSION,
            onebot_version: '12'
        }, data.echo)
    }
    async sendMessage(data: Action<'send_message'>): Promise<Resp> {
        let chat_id: string
        switch (data.params.detail_type) {
            case 'private':
                chat_id = data.params.user_id!
                break
            case 'group':
                chat_id = data.params.group_id!
                break
            default:
                return default_fail_resp(data.echo)
        }
        try {
            const [payload, method] = await segStringify(data.params.message, this.internal)
            let all_payload
            if (payload instanceof FormData) {
                payload.append('chat_id', chat_id)
                all_payload = payload
            } else {
                all_payload = { chat_id, ...payload }
            }
            // deno-lint-ignore no-explicit-any
            const result = await this.internal[method](all_payload as any)
            return success_resp({
                message_id: `${chat_id}/${result.message_id}`,
                time: result.date!
            }, data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async deleteMessage(data: Action<'delete_message'>): Promise<Resp> {
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
    async getSelfInfo(data: Action<'get_self_info'>): Promise<Resp> {
        try {
            const result = await this.internal.getMe()
            return success_resp({
                user_id: result.id?.toString()!,
                user_name: result.username!,
                user_displayname: result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name!
            }, data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getUserInfo(data: Action<'get_user_info'>): Promise<Resp> {
        try {
            const result = await this.internal.getChat({
                chat_id: data.params.user_id
            })
            return success_resp({
                user_id: result.id?.toString()!,
                user_name: result.username!,
                user_displayname: result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name!,
                user_remark: ''
            }, data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupInfo(data: Action<'get_group_info'>): Promise<Resp> {
        try {
            const result = await this.internal.getChat({
                chat_id: data.params.group_id
            })
            return success_resp({
                group_id: result.id?.toString()!,
                group_name: result.title!
            }, data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getGroupMemberInfo(data: Action<'get_group_member_info'>): Promise<Resp> {
        try {
            const result = await this.internal.getChatMember({
                chat_id: data.params.group_id,
                user_id: parseInt(data.params.user_id)
            })
            return success_resp({
                user_id: result.user?.id?.toString()!,
                user_name: result.user?.username!,
                user_displayname: result.user?.last_name ? `${result.user?.first_name} ${result.user?.last_name}` : result.user?.first_name!,
            }, data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async setGroupName(data: Action<'set_group_name'>): Promise<Resp> {
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
    async leaveGroup(data: Action<'leave_group'>): Promise<Resp> {
        try {
            await this.internal.LeaveChat({
                chat_id: data.params.group_id
            })
            return default_success_resp(data.echo)
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async uploadFile(data: Action<'upload_file'>): Promise<Resp> {
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
    async uploadFileFragmented(data: Action<'upload_file_fragmented'>): Promise<Resp> {
        try {
            switch (data.params.stage) {
                case 'prepare': {
                    await ensureDir('./teyda_data')
                    const file_name = `temp_${data.params.name}`
                    const file = await Deno.open(`./teyda_data/${file_name}`, { read: true, write: true, create: true })
                    await Deno.ftruncate(file.rid, data.params.total_size)
                    file.close()
                    return success_resp({
                        file_id: `td/${file_name}`
                    }, data.echo)
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
                    return success_resp({
                        file_id: `td/${file_name}`
                    }, data.echo)
                }
                default:
                    return default_fail_resp(data.echo)
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getFile(data: Action<'get_file'>, send_msgpack: boolean): Promise<Resp> {
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
                        return success_resp({
                            name: target[1],
                            sha256,
                            url: `data:${contentType(target[1])};base64,${base64Encode(file_data.buffer)}`
                        }, data.echo)
                    } else {
                        const result = await this.internal.getFile({
                            file_id: target[0]
                        })
                        const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                        const file_data = await file.arrayBuffer()
                        const digest = await crypto.subtle.digest("SHA-256", file_data)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        const name = basename(result.file_path!)
                        return success_resp({
                            name,
                            sha256,
                            url: `data:${contentType(name)};base64,${base64Encode(file_data)}`
                        }, data.echo)
                    }
                }
                case 'path': {
                    if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return success_resp({
                            name: target[1],
                            sha256,
                            path: await Deno.realPath(`./teyda_data/${target[1]}`)
                        }, data.echo)
                    } else {
                        const result = await this.internal.getFile({
                            file_id: target[0]
                        })
                        const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                        const file_data = await file.arrayBuffer()
                        const digest = await crypto.subtle.digest("SHA-256", file_data)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        const name = `tg_${sha256}${extname(result.file_path!)}`
                        await ensureDir("./teyda_data")
                        await Deno.writeFile(`./teyda_data/${name}`, new Uint8Array(file_data))
                        return success_resp({
                            name,
                            sha256,
                            path: await Deno.realPath(`./teyda_data/${name}`)
                        }, data.echo)
                    }
                }
                case 'data': {
                    if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return success_resp({
                            name: target[1],
                            data: send_msgpack ? file_data.buffer : base64Encode(file_data.buffer),
                            sha256
                        }, data.echo)
                    } else {
                        const result = await this.internal.getFile({
                            file_id: target[0]
                        })
                        const file = await fetch(`https://api.telegram.org/file/bot${this.tg.config.token}/${result.file_path}`)
                        const file_data = await file.arrayBuffer()
                        const digest = await crypto.subtle.digest("SHA-256", file_data)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return success_resp({
                            name: basename(result.file_path!),
                            data: send_msgpack ? file_data : base64Encode(file_data),
                            sha256
                        }, data.echo)
                    }
                }
                default:
                    return default_fail_resp(data.echo)
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
    async getFileFragmented(data: Action<'get_file_fragmented'>, send_msgpack: boolean): Promise<Resp> {
        try {
            const target = data.params.file_id.split('/')
            switch (data.params.stage) {
                case 'prepare':
                    if (target[0] === 'td') {
                        const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                        if (!file_info.isFile) {
                            return empty_fail_resp(32002, 'file_id 错误', data.echo)
                        }
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        const digest = await crypto.subtle.digest("SHA-256", file_data.buffer)
                        const sha256 = uint8ArrayToHexString(new Uint8Array(digest))
                        return success_resp({
                            name: target[1],
                            sha256,
                            total_size: file_info.size
                        }, data.echo)
                    }else{
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
                        return success_resp({
                            name: basename(result.file_path!),
                            total_size: file_info.size,
                            sha256
                        }, data.echo)
                    }
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
                    return success_resp({
                        data: send_msgpack ? buf.buffer : base64Encode(buf.buffer)
                    }, data.echo)
                }
                default:
                    return default_fail_resp(data.echo)
            }
        } catch {
            return default_fail_resp(data.echo)
        }
    }
}

function empty_fail_resp(retcode: number, message: string, echo: string | undefined): Resp {
    return {
        status: 'failed',
        data: null,
        retcode,
        message,
        echo: echo ? echo : '',
    }
}

function default_fail_resp(echo: string | undefined): Resp {
    return {
        status: 'failed',
        data: null,
        retcode: 36000,
        message: '我不想干了',
        echo: echo ? echo : '',
    }
}

function default_success_resp(echo: string | undefined): Resp {
    return {
        status: 'ok',
        data: null,
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    }
}

function success_resp<T extends Resp['data']>(data: T, echo: string | undefined) {
    return {
        status: 'ok',
        data,
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    } as const
}

/*function not_executed_fail_resp(echo: string | undefined, description: string): Resp {
    return {
        status: 'failed',
        retcode: 34000,
        data: null,
        message: `机器人平台未执行此操作: "${description}"`,
        echo: echo ? echo : '',
    }
}*/

async function saveFile(buf: ArrayBuffer, name: string, sha256: string | undefined, echo: string | undefined): Promise<Resp> {
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