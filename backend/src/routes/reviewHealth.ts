import type { FastifyPluginCallback } from 'fastify'
import { getDb } from '../db/client.js'
import { computeReviewHealth } from '../insights/reviewHealth.js'
import { ensureSynced } from '../sync/syncRepo.js'
import { insightQuerySchema } from './schema.js'

export const reviewHealthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/review-health', async (req) => {
    const { owner, repo, from, to } = insightQuerySchema.parse(req.query)
    await ensureSynced(owner, repo)
    return computeReviewHealth(getDb(), owner, repo, from, to)
  })

  done()
}
