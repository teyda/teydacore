import { Telegram } from './mod.ts'
import * as TelegramType from './types/index.ts'
import {
    Event
} from '../../deps.ts'
import { parse as segParse } from './seg.ts'
import { VERSION } from '../../version.ts'
import { getTime } from '../../utils.ts'

export class EventHandler {
    message
    notice
    meta
    constructor(tg: Telegram) {
        this.message = new Message(tg)
        this.notice = new Notice(tg)
        this.meta = new Meta(tg)
    }
}

class Meta {
    constructor(private tg: Telegram) {
    }
    statusUpdate(): Event {
        return {
            id: crypto.randomUUID(),
            time: getTime(),
            type: 'meta',
            detail_type: 'status_update',
            sub_type: '',
            status: {
                good: this.tg.online && this.tg.running,
                bots: [{
                    self: {
                        platform: this.tg.platform,
                        user_id: this.tg.info?.id?.toString()!
                    },
                    online: this.tg.online
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
    constructor(private tg: Telegram) {
    }
    private(msg: TelegramType.Message): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.tg.platform,
                user_id: this.tg.info?.id?.toString()!
            },
            time: msg.date!,
            type: 'message',
            detail_type: 'private',
            sub_type: '',
            message_id: `${msg.chat?.id}/${msg.message_id}`,
            message: segParse(msg, this.tg.info!),
            alt_message: msg.text!,
            user_id: msg.from?.id?.toString()!
        }
    }
    group(msg: TelegramType.Message): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.tg.platform,
                user_id: this.tg.info?.id?.toString()!
            },
            time: msg.date!,
            type: 'message',
            detail_type: 'group',
            sub_type: '',
            message_id: `${msg.chat?.id}/${msg.message_id}`,
            message: segParse(msg, this.tg.info!),
            alt_message: msg.text!,
            user_id: msg.from?.id?.toString()!,
            group_id: msg.chat?.id?.toString()!
        }
    }
}

class Notice {
    constructor(private tg: Telegram) {
    }
    friendIncrease(cmu: TelegramType.ChatMemberUpdated): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.tg.platform,
                user_id: this.tg.info?.id?.toString()!
            },
            time: cmu.date!,
            type: 'notice',
            detail_type: 'friend_increase',
            sub_type: '',
            user_id: cmu.from?.id?.toString()!,
        }
    }
    friendDecrease(cmu: TelegramType.ChatMemberUpdated): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.tg.platform,
                user_id: this.tg.info?.id?.toString()!
            },
            time: cmu.date!,
            type: 'notice',
            detail_type: 'friend_decrease',
            sub_type: '',
            user_id: cmu.from?.id?.toString()!,
        }
    }
    groupMemberIncrease(user: TelegramType.User, time: number): Event {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: this.tg.platform,
                user_id: this.tg.info?.id?.toString()!
            },
            time: time,
            type: 'notice',
            detail_type: 'friend_increase',
            sub_type: '',
            user_id: user.id?.toString()!,
        }
    }
}