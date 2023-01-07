import { Discord } from './mod.ts'
import * as DiscordType from './types/index.ts'
import {
    Event
} from '../../deps.ts'
import { VERSION } from '../../version.ts'
import { getTime } from '../../utils.ts'
import { parse as segParse } from './seg.ts'

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
                        platform: this.dc.platform,
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
    private(msg: DiscordType.Message.Event.Create): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.dc.platform,
                user_id: this.dc.info?.id!
            },
            time: getTime(msg.timestamp),
            type: 'message',
            detail_type: 'private',
            sub_type: '',
            message_id: msg.id,
            message: segParse(msg),
            alt_message: msg.content,
            user_id: msg.author.id
        }
    }
    channel(msg: DiscordType.Message.Event.Create): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.dc.platform,
                user_id: this.dc.info?.id!
            },
            time: getTime(msg.timestamp),
            type: 'message',
            detail_type: 'channel',
            sub_type: '',
            message_id: msg.id,
            message: segParse(msg),
            alt_message: msg.content,
            user_id: msg.author.id,
            guild_id: msg.guild_id!,
            channel_id: msg.channel_id
        }
    }
}

class Notice {
    constructor(private dc: Discord) {
    }
}