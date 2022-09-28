import * as Telegram from './types/index.ts'
import { MessageSegmentsDetail, MessageSegments, Message } from '../../deps.ts'

declare module '../../deps.ts' {
    namespace MessageSegmentsDetail {
        interface MentionData {
            'telegram.text': string
        }
        interface TelegramSticker {
            type: 'telegram.sticker'
            data: {
                file_id: string
                emoji: string
                set_name: string
            }
        }
        interface TelegramAnimation {
            type: 'telegram.animation'
            data: {
                file_id: string
            }
        }
    }
    namespace EventsDetail {
        interface Private {
            message: Message<TelegramMessageSegments>
        }
        interface Group {
            message: Message<TelegramMessageSegments>
        }
    }
    namespace ActionsDetail {
        interface SendMessageParams {
            message: Message<TelegramMessageSegments>
        }
    }
}
export type TelegramMessageSegments = MessageSegments | MessageSegmentsDetail.TelegramSticker | MessageSegmentsDetail.TelegramAnimation

export function parseSegment(message: Telegram.Message) {
    const parseText = (text: string, entities: Telegram.MessageEntity[]): Message<TelegramMessageSegments> => {
        let curr = 0
        const segs: Message<TelegramMessageSegments> = []
        for (const e of entities) {
            const eText = text.substr(e.offset!, e.length)
            if (e.type === 'mention') {
                const seg: MessageSegmentsDetail.Mention = {
                    type: 'mention',
                    data: {
                        user_id: '',
                        'telegram.text': eText.slice(1)
                    }
                }
                segs.push(seg)
            } else if (e.type === 'text_mention') {
                const seg: MessageSegmentsDetail.Mention = {
                    type: 'mention',
                    data: {
                        user_id: e.user?.id?.toString()!,
                        'telegram.text': eText.slice(1)
                    }
                }
                segs.push(seg)
            } else {
                continue
            }
            if (e.offset! > curr) {
                const seg: MessageSegmentsDetail.Text = {
                    type: 'text',
                    data: {
                        text: text.slice(curr, e.offset)
                    }
                }
                segs.splice(-1, 0, seg)
                curr = e.offset! + e.length!
            }
        }
        if (curr < text?.length || 0) {
            const seg: MessageSegmentsDetail.Text = {
                type: 'text',
                data: {
                    text: text.slice(curr)
                }
            }
            segs.push(seg)
        }
        return segs
    }
    const segments: Message<TelegramMessageSegments> = []
    if (message.reply_to_message) {
        const seg: MessageSegmentsDetail.Reply = {
            type: 'reply',
            data: {
                message_id: message.reply_to_message.message_id?.toString()!,
                user_id: message.reply_to_message.from?.id?.toString()!
            }
        }
        segments.push(seg)
    }
    if (message.location) {
        const seg: MessageSegmentsDetail.Location = {
            type: 'location',
            data: {
                latitude: message.location.latitude!,
                longitude: message.location.longitude!,
                title: '',
                content: ''
            }
        }
        segments.push(seg)
    }
    if (message.photo) {
        const photo = message.photo.sort((s1, s2) => s2.file_size! - s1.file_size!)[0]
        const seg: MessageSegmentsDetail.Image = {
            type: 'image',
            data: {
                file_id: photo.file_id!
            }
        }
        segments.push(seg)
    }
    if (message.sticker) {
        const seg: MessageSegmentsDetail.TelegramSticker = {
            type: 'telegram.sticker',
            data: {
                file_id: message.sticker.file_id!,
                emoji: message.sticker.emoji!,
                set_name: message.sticker.set_name!
            }
        }
        segments.push(seg)
    } else if (message.animation) {
        const seg: MessageSegmentsDetail.TelegramAnimation = {
            type: 'telegram.animation',
            data: {
                file_id: message.animation.file_id!
            }
        }
        segments.push(seg)
    } else if (message.voice) {
        const seg: MessageSegmentsDetail.Voice = {
            type: 'voice',
            data: {
                file_id: message.voice.file_id!
            }
        }
        segments.push(seg)
    } else if (message.video) {
        const seg: MessageSegmentsDetail.Video = {
            type: 'video',
            data: {
                file_id: message.video.file_id!
            }
        }
        segments.push(seg)
    } else if (message.document) {
        const seg: MessageSegmentsDetail.File = {
            type: 'file',
            data: {
                file_id: message.document.file_id!
            }
        }
        segments.push(seg)
    } else if (message.audio) {
        const seg: MessageSegmentsDetail.Audio = {
            type: 'audio',
            data: {
                file_id: message.audio.file_id!
            }
        }
        segments.push(seg)
    }

    const msgText: string = message.text || message.caption!
    segments.push(...parseText(msgText, message.entities || []))

    return segments
}
