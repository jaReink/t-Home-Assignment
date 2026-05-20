import { afterEach, describe, expect, it } from 'vitest'
import { getDb } from '../src/db/client.js'
import { getSyncStatus } from '../src/sync/syncRepo.js'
import { buildServer } from '../src/server.js'

afterEach(async () => {
  await getDb().deleteFrom('sync_meta').execute()
})

describe('getSyncStatus', () => {
  it('returns the stored timestamp for a previously synced repo', async () => {
    const syncedAt = '2024-01-15T10:00:00.000Z'
    await getDb()
      .insertInto('sync_meta')
      .values({ owner: 'vercel', repo: 'next.js', synced_at: syncedAt })
      .execute()

    const result = await getSyncStatus('vercel', 'next.js')

    expect(result.syncing).toBe(false)
    expect(result.lastSyncedAt).toBe(syncedAt)
  })
})

describe('GET /api/sync/status', () => {
  it('returns 422 when the owner contains a slash (path-injection attempt)', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/sync/status',
      query: { owner: 'vercel/evil', repo: 'next.js' },
    })

    expect(response.statusCode).toBe(422)
    const body = response.json<{ error: string; issues: Array<{ path: string }> }>()
    expect(body.error).toBe('Validation Error')
    expect(body.issues[0].path).toBe('owner')
  })
})
