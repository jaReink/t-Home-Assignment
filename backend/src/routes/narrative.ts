import type { FastifyPluginCallback } from 'fastify'
import { getDb } from '../db/client.js'
import { buildNarrative } from '../llm/narrative.js'
import { ensureSynced } from '../sync/syncRepo.js'
import { insightQuerySchema } from './schema.js'

export const narrativeRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/narrative', async (req) => {
    const { owner, repo, from, to } = insightQuerySchema.parse(req.query)
    await ensureSynced(owner, repo)
    return buildNarrative(owner, repo, from, to, getDb())
  })

  done()
}
