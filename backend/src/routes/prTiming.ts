import type { FastifyPluginCallback } from 'fastify'
import { getDb } from '../db/client.js'
import { computePrTiming } from '../insights/prTiming.js'
import { ensureSynced } from '../sync/syncRepo.js'
import { insightQuerySchema } from './schema.js'

export const prTimingRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/pr-timing', async (req) => {
    const { owner, repo, from, to } = insightQuerySchema.parse(req.query)
    await ensureSynced(owner, repo)
    return computePrTiming(getDb(), owner, repo, from, to)
  })

  done()
}
