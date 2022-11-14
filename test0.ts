import { Teydacore, TeydacoreConfig } from './mod.ts'

const config: TeydacoreConfig = {
    telegram: [{
        token: '',
        connect: {
            ws: [{
                host: '127.0.0.1',
                port: 9501,
                send_msgpack: false
            }]
        }
    }]
}

const app = new Teydacore()

app.start(config)