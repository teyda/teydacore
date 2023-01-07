import * as DiscordType from './types/index.ts'
import { Message } from '../../deps.ts'

declare module '../../deps.ts' {
    namespace MessageSegmentDetail {
    }
    interface MessageSegmentMap {
    }
}

export function parse(data: DiscordType.Message.Event.Create): Message {
    const segs: Message = []
    if (data.content !== '') {
        segs.push({
            type: 'text',
            data: {
                text: data.content
            }
        })
    }
    for (const { content_type, id } of data.attachments) {
        if (content_type?.includes('image/')) {
            segs.push({
                type: 'image',
                data: {
                    file_id: id
                }
            })
        }
    }
    return segs
}

export function stringify() {

}