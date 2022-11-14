import { Telegram } from './mod.ts'
import * as TelegramType from './types/index.ts'
import {
    AllEvents
} from '../../deps.ts'
import { telegram2onebot } from './seg.ts'

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
    statusUpdate(): AllEvents {
        return {
            id: crypto.randomUUID(),
            time: new Date().getTime() / 1000,
            type: 'meta',
            detail_type: 'status_update',
            sub_type: '',
            status: {
                good: this.tg.online && this.tg.running,
                bots: [{
                    self: {
                        platform: 'telegram',
                        user_id: this.tg.info?.id?.toString()!
                    },
                    online: this.tg.online
                }]
            }
        }
    }
}

class Message {
    constructor(private tg: Telegram) {
    }
    private(msg: TelegramType.Message): AllEvents {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: 'telegram',
                user_id: this.tg.info?.id?.toString()!
            },
            time: msg.date!,
            type: 'message',
            detail_type: 'private',
            sub_type: '',
            message_id: `${msg.chat?.id}/${msg.message_id}`,
            message: telegram2onebot(msg, this.tg.info!),
            alt_message: msg.text!,
            user_id: msg.from?.id?.toString()!
        }
    }
    group(msg: TelegramType.Message): AllEvents {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: 'telegram',
                user_id: this.tg.info?.id?.toString()!
            },
            time: msg.date!,
            type: 'message',
            detail_type: 'group',
            sub_type: '',
            message_id: `${msg.chat?.id}/${msg.message_id}`,
            message: telegram2onebot(msg, this.tg.info!),
            alt_message: msg.text!,
            user_id: msg.from?.id?.toString()!,
            group_id: msg.chat?.id?.toString()!
        }
    }
}

class Notice {
    constructor(private tg: Telegram) {
    }
    friendIncrease(cmu: TelegramType.ChatMemberUpdated): AllEvents {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: 'telegram',
                user_id: this.tg.info?.id?.toString()!
            },
            time: cmu.date!,
            type: 'notice',
            detail_type: 'friend_increase',
            sub_type: '',
            user_id: cmu.from?.id?.toString()!,
        }
    }
    friendDecrease(cmu: TelegramType.ChatMemberUpdated): AllEvents {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: 'telegram',
                user_id: this.tg.info?.id?.toString()!
            },
            time: cmu.date!,
            type: 'notice',
            detail_type: 'friend_decrease',
            sub_type: '',
            user_id: cmu.from?.id?.toString()!,
        }
    }
    groupMemberIncrease(user: TelegramType.User, time: number): AllEvents {
        return {
            id: crypto.randomUUID(),
            self: {
                platform: 'telegram',
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