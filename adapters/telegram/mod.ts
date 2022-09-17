import { OneBot, MetaResps, AllResps, OneBotConfig, AllActions } from '../../deps.ts'
import { Adapter, AdapterConfig } from '../../adapter.ts'

export class Telegram extends Adapter {
    private actions: Map<string, (data: AllActions) => Promise<AllResps>>
    private ob: OneBot
    private running = false
    private offset = 0
    constructor(public config: TelegramConfig) {
        super()
        this.actions = new Map([
            ['get_supported_actions', this.get_supported_actions],
        ])
        this.ob = new OneBot(async (action) => {
            return await this.actions.get(action.action)!(action)
        })
    }
    // deno-lint-ignore require-await
    private async get_supported_actions(_data: AllActions): Promise<MetaResps> {
        return {
            "status": "ok",
            "retcode": 0,
            "data": Object.keys(this.actions),
            "message": ""
        }
    }
    // deno-lint-ignore require-await
    public async start(): Promise<void> {
        this.running = true
        this.ob.start({
            basic: {
                onebot_version: 12,
                impl: 'teyda'
            },
            ...this.config.connect
        })
    }
    // deno-lint-ignore require-await
    public async stop(): Promise<void> {
        this.running = false
        this.ob.shutdown()
    }
}

export interface TelegramConfig extends AdapterConfig {
    token: string
    connect: {
        ws?: OneBotConfig['ws']
        wsr?: OneBotConfig['wsr']
    }
}