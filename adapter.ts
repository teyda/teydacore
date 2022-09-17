export abstract class Adapter<T extends AdapterConfig = AdapterConfig> {
    abstract config: T
    abstract start(): Promise<void>
    abstract stop(): Promise<void>
}

export interface AdapterConfig {
    selfId: string
}