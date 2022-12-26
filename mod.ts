import { Adapter } from './adapter.ts'
import { TelegramConfig, Telegram, DiscordConfig, Discord } from './adapters/mod.ts'

export class Teydacore {
    private adapters: Adapter[] = []
    public start(config: TeydacoreConfig) {
        if (config.telegram) {
            for (const item of config.telegram) {
                this.adapters.push(new Telegram(item))
            }
        }
        if (config.discord) {
            for (const item of config.discord) {
                this.adapters.push(new Discord(item))
            }
        }
        for (const item of this.adapters) {
            item.start()
        }
    }
    public stop() {
        for (const item of this.adapters) {
            item.stop()
        }
    }
}

export interface TeydacoreConfig {
    telegram?: TelegramConfig[]
    discord?: DiscordConfig[]
}