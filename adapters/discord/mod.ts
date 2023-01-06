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
    public readonly support_action = ['get_supported_actions', 'get_status', 'get_version']
    private internal: DiscordType.Internal
    private ah: ActionHandler
    private eh: EventHandler
    public info: DiscordType.User | undefined
    constructor(config: DiscordConfig) {
        super(config)
        this.internal = new DiscordType.Internal(`https://discord.com/api/v10`, config.token)
        this.ah = new ActionHandler(this, this.internal)
        this.eh = new EventHandler(this)
        this.ob = new DnlibobApp((data, _send_msgpack) => {
            switch (data.action) {
                case 'get_supported_actions':
                    return this.ah.getSupportedActions(data)
                case 'get_status':
                    return this.ah.getStatus(data)
                case 'get_version':
                    return this.ah.getVersion(data)
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
                this.changeOnline(true)
            }
        })
        socket.addEventListener('message', ({ data }) => {
            const parsed: DiscordType.GatewayPayload = JSON.parse(data)
            console.log(parsed)
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
                        properties: {},
                        intents: 0
                            | DiscordType.GatewayIntent.GUILD_MESSAGES
                            | DiscordType.GatewayIntent.GUILD_MESSAGE_REACTIONS
                            | DiscordType.GatewayIntent.DIRECT_MESSAGES
                            | DiscordType.GatewayIntent.DIRECT_MESSAGE_REACTIONS
                            | DiscordType.GatewayIntent.MESSAGE_CONTENT,
                    },
                }))
            }
            if (parsed.op === DiscordType.GatewayOpcode.DISPATCH) {
                if (parsed.t === 'READY') {
                    this._sessionId = parsed.d!.session_id
                    this.info = parsed.d!.user
                    return this.changeOnline(true)
                }
                this.dispatch(parsed)
            }
        })
        socket.addEventListener('close', () => {
            clearInterval(this._ping)
            this.changeOnline(false)
            setTimeout(() => { this.ws() }, 500)
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
                        platform: 'discord',
                        user_id: data.id
                    },
                    ...this.config.connect,
                }, () => {
                    return [this.eh.meta.connect(), this.eh.meta.statusUpdate()]
                })
                this.ws()
            }).catch(() => {
                setTimeout(get_me, 500)
            })
        }
        get_me()
    }
    private dispatch(e: DiscordType.GatewayPayload) {
        console.log(e)
    }
    private changeOnline(bool: boolean) {
        if (bool === this.online) return
        this.online = bool
        this.ob.send(this.eh.meta.statusUpdate())
    }
    public stop() {
        this.running = false
        this.ob.shutdown()
    }
}