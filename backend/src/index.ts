import { config } from './config.js'
import { buildServer } from './server.js'

const app = buildServer()

app.listen({ port: config.PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
