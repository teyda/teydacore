import { Adapter } from './adapter.ts'
import { TelegramConfig, Telegram } from './adapters/mod.ts'

export class Teydacore {
    private adapters: Adapter[] = []
    public start(config: TeydacoreConfig) {
        if (config.telegram) {
            for (const item of config.telegram) {
                this.adapters.push(new Telegram(item))
            }
        }
        for (const item of this.adapters){
            item.start()
        }
    }
    public stop() {
        for (const item of this.adapters){
            item.stop()
        }
    }
}

export interface TeydacoreConfig {
    telegram?: TelegramConfig[]
}