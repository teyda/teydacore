export abstract class Adapter<T extends AdapterConfig = AdapterConfig> {
    constructor(public config: T) {
    }
    abstract start(): Promise<void> | void
    abstract stop(): Promise<void> | void
}

// deno-lint-ignore no-empty-interface
export interface AdapterConfig {
}