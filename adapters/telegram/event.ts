import { Telegram } from './mod.ts'
import * as TelegramType from './types/index.ts'
import {
    AllEvents
} from '../../deps.ts'
import { telegram2onebot } from './seg.ts'

export class EventHandler {
    public message
    public notice
    constructor(tg: Telegram, internal: TelegramType.Internal) {
        this.message = new Message(tg, internal)
        this.notice = new Notice(tg, internal)
    }
}

class Message {
    constructor(private tg: Telegram, private internal: TelegramType.Internal) {
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
            message: telegram2onebot(msg),
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
            message: telegram2onebot(msg),
            alt_message: msg.text!,
            user_id: msg.from?.id?.toString()!,
            group_id: msg.chat?.id?.toString()!
        }
    }
}

class Notice {
    constructor(private tg: Telegram, private internal: TelegramType.Internal) {
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