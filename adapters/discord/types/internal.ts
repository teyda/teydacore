// deno-lint-ignore-file no-explicit-any
import { Dict, makeArray } from '../../../deps.ts'

type Method = 'GET' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH'

export class Internal {
  [index: string]: any
  constructor(private endpoint: string) { }

  static define(routes: Dict<Partial<Record<Method, string | string[]>>>) {
    for (const path in routes) {
      for (const key in routes[path]) {
        const method = key as Method
        for (const name of makeArray(routes[path][method])) {
          Internal.prototype[name!] = async function (this: Internal, ...args: any[]) {
            const raw = args.join(', ')
            const url = path.replace(/\{([^}]+)\}/g, () => {
              if (!args.length) throw new Error(`too few arguments for ${path}, received ${raw}`)
              return args.shift()
            })
            const init: RequestInit = {}
            let params = ''
            if (args.length === 1) {
              if (method === 'GET' || method === 'DELETE') {
                params = `?${new URLSearchParams(args[0]).toString()}`
              } else {
                init.body = JSON.stringify(args[0])
              }
            } else if (args.length === 2 && method !== 'GET' && method !== 'DELETE') {
              init.body = JSON.stringify(args[0])
              params = `?${new URLSearchParams(args[1]).toString()}`
            } else if (args.length > 1) {
              throw new Error(`too many arguments for ${path}, received ${raw}`)
            }
            const res = await fetch(`${this.endpoint}/${url}${params}`, init)
            return res.json()
          }
        }
      }
    }
  }
}
