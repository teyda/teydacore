// deno-lint-ignore-file no-explicit-any no-empty-interface
import { Logger } from '../../../deps.ts'

export interface Internal extends Record<string, any> { }

const logger = new Logger('telegram')

export class Internal {
  constructor(public endpoint: string) { }
  static define(method: string) {
    Internal.prototype[method] = async function (this: Internal, data = {}) {
      logger.debug('[request] %s %o', method, data)
      try {
        let response: any
        if (data instanceof FormData) {
          response = await fetch(`${this.endpoint}/${method}`, {
            method: "POST",
            body: data
          })
        } else {
          response = await fetch(`${this.endpoint}/${method}`, {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          })
        }
        logger.debug('[response] %o', response)
        const res_data = await response.json()
        if (res_data.ok) return res_data.result
        throw new Error(`Telegram API error ${res_data.error_code}. ${res_data.description}`)
      } catch (err) {
        throw err
      }
    }
  }
}
