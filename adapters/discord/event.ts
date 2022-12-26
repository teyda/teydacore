import { Discord } from './mod.ts'
import * as DiscordType from './types/index.ts'
import {
    Event
} from '../../deps.ts'
import { VERSION } from '../../version.ts'
import { getTime } from '../../utils.ts'

export class EventHandler {
    message
    notice
    meta
    constructor(dc: Discord) {
        this.message = new Message(dc)
        this.notice = new Notice(dc)
        this.meta = new Meta(dc)
    }
}

class Meta {
    constructor(private dc: Discord) {
    }
    statusUpdate(): Event {
        return {
            id: crypto.randomUUID(),
            time: getTime(),
            type: 'meta',
            detail_type: 'status_update',
            sub_type: '',
            status: {
                good: this.dc.online && this.dc.running,
                bots: [{
                    self: {
                        platform: 'discord',
                        user_id: this.dc.info?.id!
                    },
                    online: this.dc.online
                }]
            }
        }
    }
    connect(): Event {
        return {
            id: crypto.randomUUID(),
            time: getTime(),
            type: 'meta',
            detail_type: 'connect',
            sub_type: '',
            version: {
                impl: 'teyda',
                version: VERSION,
                onebot_version: '12'
            }
        }
    }
}

class Message {
    constructor(private dc: Discord) {
    }
}

class Notice {
    constructor(private dc: Discord) {
    }
}