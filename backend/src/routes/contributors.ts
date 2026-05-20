import type { FastifyPluginCallback } from 'fastify'
import { getDb } from '../db/client.js'
import { computeContributors } from '../insights/contributors.js'
import { ensureSynced } from '../sync/syncRepo.js'
import { insightQuerySchema } from './schema.js'

export const contributorsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/contributors', async (req) => {
    const { owner, repo, from, to } = insightQuerySchema.parse(req.query)
    await ensureSynced(owner, repo)
    return computeContributors(getDb(), owner, repo, from, to)
  })

  done()
}
