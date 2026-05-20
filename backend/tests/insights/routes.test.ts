import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../../src/db/client.js'
import { buildServer } from '../../src/server.js'

vi.mock('../../src/sync/syncRepo.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/sync/syncRepo.js')>()
  return { ...actual, ensureSynced: vi.fn().mockResolvedValue(undefined) }
})

const OWNER = 'owner1'
const REPO = 'repo1'
const BASE_QUERY = { owner: OWNER, repo: REPO, from: '2024-01-01', to: '2024-02-01' }

afterEach(async () => {
  const db = getDb()
  await db.deleteFrom('reviews').execute()
  await db.deleteFrom('pulls').execute()
  await db.deleteFrom('commits').execute()
})

describe('GET /api/contributors', () => {
  it('returns contributor data for seeded pulls and commits', async () => {
    const db = getDb()
    await db.insertInto('pulls').values(
      { id: 1, owner: OWNER, repo: REPO, number: 1, author: 'author1', created_at: '2024-01-10T00:00:00Z', merged_at: '2024-01-12T00:00:00Z', merged_by: 'author1', additions: 50, deletions: 10 },
    ).execute()
    await db.insertInto('commits').values(
      { sha: 'abc1', owner: OWNER, repo: REPO, author: 'author1', authored_at: '2024-01-10T00:00:00Z' },
    ).execute()

    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/contributors', query: BASE_QUERY })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ totalPrs: number; contributors: Array<{ login: string }> }>()
    expect(body.totalPrs).toBe(1)
    expect(body.contributors.find(c => c.login === 'author1')).toBeDefined()
  })

  it('returns 422 when from is not a valid date', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/contributors',
      query: { owner: OWNER, repo: REPO, from: 'not-a-date', to: '2024-02-01' },
    })

    expect(response.statusCode).toBe(422)
    const body = response.json<{ error: string; issues: Array<{ path: string }> }>()
    expect(body.error).toBe('Validation Error')
    expect(body.issues[0].path).toBe('from')
  })
})

describe('GET /api/review-health', () => {
  it('returns review health metrics for seeded data', async () => {
    const db = getDb()
    await db.insertInto('pulls').values(
      { id: 2, owner: OWNER, repo: REPO, number: 2, author: 'author1', created_at: '2024-01-10T00:00:00Z', merged_at: '2024-01-12T00:00:00Z', merged_by: 'reviewer1', additions: 30, deletions: 5 },
    ).execute()
    await db.insertInto('reviews').values(
      { id: 201, owner: OWNER, repo: REPO, pull_number: 2, reviewer: 'reviewer1', state: 'APPROVED', submitted_at: '2024-01-11T00:00:00Z', body_length: 50, inline_comments: 2 },
    ).execute()

    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/review-health', query: BASE_QUERY })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ totalMergedPrs: number }>()
    expect(body.totalMergedPrs).toBe(1)
  })

  it('returns 422 when repo name is missing', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/review-health',
      query: { owner: OWNER, from: '2024-01-01', to: '2024-02-01' },
    })

    expect(response.statusCode).toBe(422)
  })
})

describe('GET /api/pr-timing', () => {
  it('returns timing percentiles and buckets for seeded data', async () => {
    const db = getDb()
    await db.insertInto('pulls').values(
      { id: 3, owner: OWNER, repo: REPO, number: 3, author: 'author1', created_at: '2024-01-10T00:00:00Z', merged_at: '2024-01-11T00:00:00Z', merged_by: 'reviewer1', additions: 20, deletions: 0 },
    ).execute()
    await db.insertInto('reviews').values(
      { id: 301, owner: OWNER, repo: REPO, pull_number: 3, reviewer: 'reviewer1', state: 'APPROVED', submitted_at: '2024-01-10T02:00:00Z', body_length: 10, inline_comments: 0 },
    ).execute()

    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/pr-timing', query: BASE_QUERY })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ totalPrsWithReview: number; buckets: unknown[] }>()
    expect(body.totalPrsWithReview).toBe(1)
    expect(body.buckets).toHaveLength(5)
  })

  it('returns 422 when owner contains invalid characters', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/pr-timing',
      query: { owner: 'bad owner!', repo: REPO, from: '2024-01-01', to: '2024-02-01' },
    })

    expect(response.statusCode).toBe(422)
  })
})
