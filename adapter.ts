export abstract class Adapter<T extends AdapterConfig = AdapterConfig> {
    abstract config: T
    abstract start(): Promise<void> | void
    abstract stop(): Promise<void> | void
}

export interface AdapterConfig {
    self_id: string
}