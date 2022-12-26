import {
    Action,
    Resp,
    ensureDir,
    base64Decode,
    contentType,
    base64Encode,
    basename,
    extname
} from '../../deps.ts'
import * as DiscordType from './types/index.ts'
import { onebot2telegram } from './seg.ts'
import { VERSION } from '../../version.ts'
import { uint8ArrayToHexString } from '../../utils.ts'
import { Discord } from './mod.ts'

export class ActionHandler {
    constructor(private dc: Discord, private internal: DiscordType.Internal) {
    }
    getSupportedActions(data: Action): Resp {
        return success_resp(Object.keys(this.dc.support_action), data.echo)
    }
}

function empty_fail_resp(retcode: number, message: string, echo: string | undefined): Resp {
    return {
        status: 'failed',
        data: null,
        retcode,
        message,
        echo: echo ? echo : '',
    }
}

function default_fail_resp(echo: string | undefined): Resp {
    return {
        status: 'failed',
        data: null,
        retcode: 36000,
        message: '我不想干了',
        echo: echo ? echo : '',
    }
}

function default_success_resp(echo: string | undefined): Resp {
    return {
        status: 'ok',
        data: null,
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    }
}

function success_resp<T extends Resp['data']>(data: T, echo: string | undefined) {
    return {
        status: 'ok',
        data,
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    } as const
}

/*function not_executed_fail_resp(echo: string | undefined, description: string): Resp {
    return {
        status: 'failed',
        retcode: 34000,
        data: null,
        message: `机器人平台未执行此操作: "${description}"`,
        echo: echo ? echo : '',
    }
}*/

async function saveFile(buf: ArrayBuffer, name: string, sha256: string | undefined, echo: string | undefined): Promise<Resp> {
    if (sha256) {
        const digest = await crypto.subtle.digest("SHA-256", buf)
        const hash = uint8ArrayToHexString(new Uint8Array(digest))
        if (hash !== sha256) {
            return empty_fail_resp(32001, 'SHA-256 hash 不匹配', echo)
        }
    }
    await ensureDir("./teyda_data")
    await Deno.writeFile(`./teyda_data/${name}`, new Uint8Array(buf))
    return {
        status: 'ok',
        data: {
            file_id: `td/${name}`
        },
        retcode: 0,
        message: '',
        echo: echo ? echo : '',
    }
}