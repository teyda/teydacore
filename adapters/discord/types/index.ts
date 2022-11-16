// Last updated: Jun 29, 2022

export * from './internal.ts'

export * from './application.ts'
export * from './audit-log.ts'
export * from './auto-moderation.ts'
export * from './ban.ts'
export * from './channel.ts'
export * from './command.ts'
export * from './component.ts'
export * from './device.ts'
export * from './emoji.ts'
export * from './gateway.ts'
export * from './guild-member.ts'
export * from './guild-template.ts'
export * from './guild.ts'
export * from './integration.ts'
export * from './interaction.ts'
export * from './invite.ts'
export * from './message.ts'
export * from './presence.ts'
export * from './reaction.ts'
export * from './role.ts'
export * from './scheduled-event.ts'
export * from './stage-instance.ts'
export * from './sticker.ts'
export * from './team.ts'
export * from './thread.ts'
export * from './user.ts'
export * from './voice.ts'
export * from './webhook.ts'

export type integer = number
export type snowflake = string
export type timestamp = string

/** @see https://discord.com/developers/docs/reference#locales */
export type Locale =
  | 'da' | 'de' | 'en-GB' | 'en-US' | 'es-ES'
  | 'fr' | 'hr' | 'it' | 'lt' | 'hu'
  | 'nl' | 'no' | 'pl' | 'pt-BR' | 'ro'
  | 'fi' | 'sv-SE' | 'vi' | 'tr' | 'cs'
  | 'el' | 'bg' | 'ru' | 'uk' | 'hi'
  | 'th' | 'zh-CN' | 'ja' | 'zh-TW' | 'ko'