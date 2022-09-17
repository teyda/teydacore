import { InputFile, Integer } from './index.ts'

/**
 * This object represents an incoming update. At most one of the optional parameters can be present in any given update.
 * @see https://core.telegram.org/bots/api#update
 */
export interface Update {
  /** The update's unique identifier. Update identifiers start from a certain positive number and increase sequentially. This ID becomes especially handy if you're using Webhooks, since it allows you to ignore repeated updates or to restore the correct update sequence, should they get out of order. If there are no new updates for at least a week, then identifier of the next update will be chosen randomly instead of sequentially. */
  update_id?: Integer
}

export interface GetUpdatesPayload {
  /** Identifier of the first update to be returned. Must be greater by one than the highest among the identifiers of previously received updates. By default, updates starting with the earliest unconfirmed update are returned. An update is considered confirmed as soon as getUpdates is called with an offset higher than its update_id. The negative offset can be specified to retrieve updates starting from -offset update from the end of the updates queue. All previous updates will forgotten. */
  offset?: Integer
  /** Limits the number of updates to be retrieved. Values between 1-100 are accepted. Defaults to 100. */
  limit?: Integer
  /** Timeout in seconds for long polling. Defaults to 0, i.e. usual short polling. Should be positive, short polling should be used for testing purposes only. */
  timeout?: Integer
  /**
   * A JSON-serialized list of the update types you want your bot to receive. For example, specify ["message", "edited_channel_post", "callback_query"] to only receive updates of these types. See Update for a complete list of available update types. Specify an empty list to receive all update types except chat_member (default). If not specified, the previous setting will be used.
   * Please note that this parameter doesn't affect updates created before the call to the getUpdates, so unwanted updates may be received for a short period of time.
   */
  allowed_updates?: string[]
}

export interface SetWebhookPayload {
  /** HTTPS url to send updates to. Use an empty string to remove webhook integration */
  url?: string
  /** Upload your public key certificate so that the root certificate in use can be checked. See our self-signed guide for details. */
  certificate?: InputFile
  /** The fixed IP address which will be used to send webhook requests instead of the IP address resolved through DNS */
  ip_address?: string
  /** Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery, 1-100. Defaults to 40. Use lower values to limit the load on your bot's server, and higher values to increase your bot's throughput. */
  max_connections?: Integer
  /**
   * A JSON-serialized list of the update types you want your bot to receive. For example, specify ["message", "edited_channel_post", "callback_query"] to only receive updates of these types. See Update for a complete list of available update types. Specify an empty list to receive all update types except chat_member (default). If not specified, the previous setting will be used.
   *
   * Please note that this parameter doesn't affect updates created before the call to the setWebhook, so unwanted updates may be received for a short period of time.
   */
  allowed_updates?: string[]
  /** Pass True to drop all pending updates */
  drop_pending_updates?: boolean
}

export interface DeleteWebhookPayload {
  /** Pass True to drop all pending updates */
  drop_pending_updates?: boolean
}

/**
 * Contains information about the current status of a webhook.
 * @see https://core.telegram.org/bots/api#webhookinfo
 */
export interface WebhookInfo {
  /** Webhook URL, may be empty if webhook is not set up */
  url?: string
  /** True, if a custom certificate was provided for webhook certificate checks */
  has_custom_certificate?: boolean
  /** Number of updates awaiting delivery */
  pending_update_count?: Integer
  /** Optional. Currently used webhook IP address */
  ip_address?: string
  /** Optional. Unix time for the most recent error that happened when trying to deliver an update via webhook */
  last_error_date?: Integer
  /** Optional. Error message in human-readable format for the most recent error that happened when trying to deliver an update via webhook */
  last_error_message?: string
  /** Optional. Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery */
  max_connections?: Integer
  /** Optional. A list of update types the bot is subscribed to. Defaults to all update types except chat_member */
  allowed_updates?: string[]
}
