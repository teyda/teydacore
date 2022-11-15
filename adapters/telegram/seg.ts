import * as TelegramType from './types/index.ts'
import { Message } from '../../deps.ts'

declare module '../../deps.ts' {
    namespace MessageSegmentsDetail {
        interface MentionData {
            'telegram.text': string
        }
    }
    interface MessageSegmentMap {
        'telegram.sticker': {
            type: 'telegram.sticker'
            data: {
                file_id: string
                emoji: string
                set_name: string
            }
        }
        'telegram.animation': {
            type: 'telegram.animation'
            data: {
                file_id: string
            }
        }
    }
}

export function telegram2onebot(message: TelegramType.Message, info: TelegramType.User): Message {
    const parseText = (text: string, entities: TelegramType.MessageEntity[]): Message => {
        let curr = 0
        const segs: Message = []
        for (const e of entities) {
            const eText = text.substring(e.offset!, e.offset! + e.length!)
            if (e.type === 'mention') {
                if (eText === `@${info.username}`) {
                    segs.push({
                        type: 'mention',
                        data: {
                            user_id: info.id!.toString(),
                            'telegram.text': eText
                        }
                    })
                } else {
                    segs.push({
                        type: 'mention',
                        data: {
                            user_id: '',
                            'telegram.text': eText
                        }
                    })
                }
                if (e.offset === 0) {
                    curr += e.length!
                }
            } else if (e.type === 'text_mention') {
                segs.push({
                    type: 'mention',
                    data: {
                        user_id: e.user?.id?.toString()!,
                        'telegram.text': eText
                    }
                })
                if (e.offset === 0) {
                    curr += e.length!
                }
            } else {
                continue
            }
            if (e.offset! > curr) {
                segs.splice(-1, 0, {
                    type: 'text',
                    data: {
                        text: text.slice(curr, e.offset)
                    }
                })
                curr = e.offset! + e.length!
            }
        }
        if (curr < text?.length || 0) {
            segs.push({
                type: 'text',
                data: {
                    text: text.slice(curr)
                }
            })
        }
        return segs
    }
    const segments: Message = []
    if (message.reply_to_message) {
        segments.push({
            type: 'reply',
            data: {
                message_id: message.reply_to_message.message_id?.toString()!,
                user_id: message.reply_to_message.from?.id?.toString()!
            }
        })
    }
    if (message.location) {
        segments.push({
            type: 'location',
            data: {
                latitude: message.location.latitude!,
                longitude: message.location.longitude!,
                title: '',
                content: ''
            }
        })
    } else if (message.photo) {
        const photo = message.photo.sort((s1, s2) => s2.file_size! - s1.file_size!)[0]
        segments.push({
            type: 'image',
            data: {
                file_id: photo.file_id!
            }
        })
    } else if (message.sticker) {
        segments.push({
            type: 'telegram.sticker',
            data: {
                file_id: message.sticker.file_id!,
                emoji: message.sticker.emoji!,
                set_name: message.sticker.set_name!
            }
        })
    } else if (message.animation) {
        segments.push({
            type: 'telegram.animation',
            data: {
                file_id: message.animation.file_id!
            }
        })
    } else if (message.voice) {
        segments.push({
            type: 'voice',
            data: {
                file_id: message.voice.file_id!
            }
        })
    } else if (message.video) {
        segments.push({
            type: 'video',
            data: {
                file_id: message.video.file_id!
            }
        })
    } else if (message.document) {
        segments.push({
            type: 'file',
            data: {
                file_id: message.document.file_id!
            }
        })
    } else if (message.audio) {
        segments.push({
            type: 'audio',
            data: {
                file_id: message.audio.file_id!
            }
        })
    }

    const msgText: string = message.text || message.caption!
    segments.push(...parseText(msgText, message.entities || []))

    return segments
}

const assetApi = {
    image: 'sendPhoto',
    audio: 'sendAudio',
    file: 'sendDocument',
    video: 'sendVideo',
    'telegram.animation': 'sendAnimation',
    voice: 'sendVoice',
    location: 'sendLocation',
    'telegram.sticker': 'sendSticker'
} as const

type ValueOf<T> = T[keyof T]

type Method = ValueOf<typeof assetApi> | 'sendMessage'

interface Payload {
    photo?: string
    document?: string
    animation?: string
    audio?: string
    video?: string
    voice?: string
    latitude?: number
    longitude?: number
    sticker?: string
    text?: string
    entities?: TelegramType.SendMessagePayload['entities']
    reply_to_message_id?: number
}

export async function onebot2telegram(segs: Message, internal: TelegramType.Internal): Promise<[Payload | FormData, Method]> {
    const payload: Payload = {}
    let offset = 0
    for (const seg of segs) {
        switch (seg.type) {
            case 'reply': {
                payload.reply_to_message_id = parseInt(seg.data.message_id)
                break
            }
            case 'image': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('photo', new Blob([file_data.buffer]), target[1])
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.photo = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'file': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('document', new Blob([file_data.buffer]))
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.document = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'telegram.animation': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('animation', new Blob([file_data.buffer]))
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.animation = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'audio': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('audio', new Blob([file_data.buffer]))
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.audio = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'video': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('video', new Blob([file_data.buffer]))
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.video = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'voice': {
                const target = seg.data.file_id.split('/')
                if (target[0] === 'td') {
                    const form_data = new FormData()
                    const file_info = await Deno.lstat(`./teyda_data/${target[1]}`)
                    if (file_info.isFile) {
                        const file_data = await Deno.readFile(`./teyda_data/${target[1]}`)
                        form_data.append('voice', new Blob([file_data.buffer]))
                    }
                    return [form_data, assetApi[seg.type]]
                } else {
                    payload.voice = seg.data.file_id
                    return [payload, assetApi[seg.type]]
                }
            }
            case 'location': {
                payload.latitude = seg.data.latitude
                payload.longitude = seg.data.longitude
                return [payload, assetApi[seg.type]]
            }
            case 'telegram.sticker': {
                payload.sticker = seg.data.file_id
                return [payload, assetApi[seg.type]]
            }
            case 'mention': {
                if (!payload.text) {
                    payload.text = ''
                }
                if (!payload.entities) {
                    payload.entities = []
                }
                let length: number
                let text_mention = false
                if (seg.data.user_id === '') {
                    payload.text += seg.data['telegram.text']
                    length = seg.data['telegram.text'].length
                } else {
                    const result = await internal.getChat({
                        chat_id: seg.data.user_id
                    })
                    if (result.username) {
                        const text = `@${result.username}`
                        payload.text += text
                        length = text.length
                    } else {
                        const text = result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name!
                        payload.text += text
                        length = text.length
                        payload.entities.push({
                            type: 'text_mention',
                            offset,
                            length,
                            user: {
                                id: result.id
                            }
                        })
                        offset += length
                        text_mention = true
                    }
                }
                if (!text_mention) {
                    payload.entities.push({
                        type: 'mention',
                        offset,
                        length
                    })
                    offset += length
                }
                break
            }
            case 'text': {
                if (!payload.text) {
                    payload.text = ''
                }
                payload.text += seg.data.text
                offset += seg.data.text.length
                break
            }
        }
    }
    return [payload, 'sendMessage']
}