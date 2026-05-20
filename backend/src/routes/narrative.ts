import type { FastifyPluginCallback } from 'fastify'
import { getDb } from '../db/client.js'
import { buildNarrative, type NarrativeResponse } from '../llm/narrative.js'
import { ensureSynced } from '../sync/syncRepo.js'
import { insightQuerySchema } from './schema.js'
import { config } from '../config.js'

const MAX_CACHE_SIZE = 100

interface CacheEntry {
  result: NarrativeResponse
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<NarrativeResponse>>()

function cacheKey(owner: string, repo: string, from: Date, to: Date): string {
  return `${owner}|${repo}|${from.toISOString()}|${to.toISOString()}`
}

export const narrativeRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/narrative', async (req) => {
    const { owner, repo, from, to } = insightQuerySchema.parse(req.query)

    const key = cacheKey(owner, repo, from, to)

    const cached = cache.get(key)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result
    }

    const existing = inFlight.get(key)
    if (existing) return existing

    const promise = (async () => {
      try {
        await ensureSynced(owner, repo)
        const result = await buildNarrative(owner, repo, from, to, getDb())

        if (cache.size >= MAX_CACHE_SIZE) {
          const oldest = cache.keys().next().value
          if (oldest) cache.delete(oldest)
        }

        cache.set(key, {
          result,
          expiresAt: Date.now() + config.NARRATIVE_CACHE_TTL_MINUTES * 60 * 1000,
        })

        return result
      } finally {
        inFlight.delete(key)
      }
    })()

    inFlight.set(key, promise)
    return promise
  })

  done()
}
