import {
    DnlibobApp,
    Event,
    DnlibobAppConfig,
} from '../../deps.ts'
import { Adapter } from "../../adapter.ts"
import * as DiscordType from './types/index.ts'
import { ActionHandler } from './action.ts'
import { AdapterConfig } from "../../adapter.ts"
import { EventHandler } from './event.ts'

export interface DiscordConfig extends AdapterConfig {
    token: string
    connect: {
        ws?: DnlibobAppConfig["ws"]
        wsr?: DnlibobAppConfig["wsr"]
    }
}

export class Discord extends Adapter<DiscordConfig> {
    private ob: DnlibobApp
    public running = false
    public online = false
    private _d = 0
    private _sessionId = ''
    private _ping: number | undefined
    public readonly support_action = ['get_supported_actions', 'get_status', 'get_version', 'send_message', 'delete_message', 'get_self_info', 'get_user_info', 'get_group_info', 'get_group_member_info', 'set_group_name', 'leave_group', 'upload_file', 'upload_file_fragmented', 'get_file', 'get_file_fragmented']
    private internal: DiscordType.Internal
    private ah: ActionHandler
    private eh: EventHandler
    public info: DiscordType.User | undefined
    constructor(config: DiscordConfig) {
        super(config)
        this.internal = new DiscordType.Internal(`https://discord.com/api/v10`, config.token)
        this.ah = new ActionHandler(this, this.internal)
        this.eh = new EventHandler(this)
        this.ob = new DnlibobApp(async (data, send_msgpack) => {
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
        }, () => { this.ob.send(this.eh.meta.statusUpdate()) })
    }
    private ws() {
        const socket = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json')
        socket.addEventListener('open', () => {
            if (this._sessionId) {
                socket.send(JSON.stringify({
                    op: DiscordType.GatewayOpcode.RESUME,
                    d: {
                        token: this.config.token,
                        session_id: this._sessionId,
                        seq: this._d,
                    },
                }))
            }
            this.change_online(true)
        })
        socket.addEventListener('message', (event) => {
            const parsed: DiscordType.GatewayPayload = JSON.parse(event.data.toString())
            if (parsed.s) {
                this._d = parsed.s
            }
            if (parsed.op === DiscordType.GatewayOpcode.HELLO) {
                this._ping = setInterval(() => {
                    socket.send(JSON.stringify({
                        op: DiscordType.GatewayOpcode.HEARTBEAT,
                        d: this._d,
                    }))
                }, parsed.d!.heartbeat_interval)
                if (this._sessionId) return
                socket.send(JSON.stringify({
                    op: DiscordType.GatewayOpcode.IDENTIFY,
                    d: {
                        token: this.config.token,
                        properties: {
                            os:Deno.osRelease
                        },
                        intents: 0
                            | DiscordType.GatewayIntent.GUILD_MESSAGES
                            | DiscordType.GatewayIntent.GUILD_MESSAGE_REACTIONS
                            | DiscordType.GatewayIntent.DIRECT_MESSAGES
                            | DiscordType.GatewayIntent.DIRECT_MESSAGE_REACTIONS
                            | DiscordType.GatewayIntent.MESSAGE_CONTENT,
                    },
                }))
            }

            if (parsed.op === GatewayOpcode.DISPATCH) {
                if (parsed.t === 'READY') {
                    this._sessionId = parsed.d.session_id
                    const self: any = adaptUser(parsed.d.user)
                    self.selfId = self.userId
                    delete self.userId
                    Object.assign(this.bot, self)
                    logger.debug('session_id ' + this._sessionId)
                    return this.bot.online()
                }
                const session = await adaptSession(this.bot, parsed)
                if (session) this.bot.dispatch(session)
            }
        })
        socket.addEventListener('close', () => {
            setTimeout(() => this.ws(), 500)
        })
    }
    public start() {
        if (this.running) return
        const get_me = () => {
            this.internal.getCurrentUser().then(data => {
                this.info = data
                this.running = true
                this.ob.start({
                    basic: {
                        onebot_version: '12',
                        impl: "teyda",
                    },
                    ...this.config.connect,
                })
                this.ws()
            }).catch(() => {
                setTimeout(get_me, 500)
            })
        }
        get_me()
    }
    private change_online(bool: boolean) {
        if (bool === this.online) return
        this.online = bool
        this.ob.send(this.eh.meta.statusUpdate())
    }
    public stop() {
        this.running = false
        this.ob.shutdown()
    }
}