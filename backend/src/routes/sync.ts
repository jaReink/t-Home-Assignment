import type { FastifyPluginCallback } from 'fastify'
import { z } from 'zod'
import { syncRepo, getSyncStatus, SyncConflictError } from '../sync/syncRepo.js'
import { repoSchema } from './schema.js'

const syncBodySchema = repoSchema.extend({
  lookbackMonths: z.coerce.number().min(1).max(24).optional(),
})

export const syncRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/sync/status', async (req) => {
    const { owner, repo } = repoSchema.parse(req.query)
    return { owner, repo, ...await getSyncStatus(owner, repo) }
  })

  app.post('/api/sync', async (req, reply) => {
    const body = syncBodySchema.parse(req.body)

    try {
      const result = await syncRepo(body.owner, body.repo, body.lookbackMonths)
      return result
    } catch (err) {
      if (err instanceof SyncConflictError) {
        return reply.status(409).send({ error: err.message })
      }
      throw err
    }
  })

  done()
}
