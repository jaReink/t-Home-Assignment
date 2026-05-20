import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { getDb } from './db/client.js'
import { GitHubError, RateLimitError } from './github/types.js'
import { contributorsRoutes } from './routes/contributors.js'
import { narrativeRoutes } from './routes/narrative.js'
import { prTimingRoutes } from './routes/prTiming.js'
import { reviewHealthRoutes } from './routes/reviewHealth.js'
import { syncRoutes } from './routes/sync.js'

export function buildServer() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })
  app.register(syncRoutes)
  app.register(contributorsRoutes)
  app.register(reviewHealthRoutes)
  app.register(prTimingRoutes)
  app.register(narrativeRoutes)

  app.get('/health', async (_req, reply) => {
    try {
      await getDb().selectFrom('sync_meta').select('owner').limit(1).execute()
      return { status: 'ok', uptime: process.uptime() }
    } catch {
      return reply.status(503).send({ status: 'degraded', uptime: process.uptime() })
    }
  })

  app.setErrorHandler((error: Error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: 'Validation Error',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }

    if (error instanceof RateLimitError) {
      return reply.status(503).send({
        error: 'GitHub rate limit exceeded',
        retryAfter: error.resetAt.toISOString(),
      })
    }

    if (error instanceof GitHubError) {
      const status = error.statusCode === 404 ? 404 : 502
      return reply.status(status).send({ error: error.message })
    }

    app.log.error(error)
    return reply.status((error as FastifyError).statusCode ?? 500).send({ error: error.message })
  })

  return app
}
