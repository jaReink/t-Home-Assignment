import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FetchPRsResult, GitHubCommit } from '../src/github/types.js'
import { getDb } from '../src/db/client.js'
import { syncRepo, SyncConflictError } from '../src/sync/syncRepo.js'

vi.mock('../src/github/client.js', () => ({
  fetchPullsWithReviews: vi.fn(),
  fetchCommits: vi.fn(),
}))

import { fetchPullsWithReviews, fetchCommits } from '../src/github/client.js'

const fakePR: FetchPRsResult['prs'][number] = {
  id: 1001,
  number: 42,
  author: 'gaearon',
  createdAt: '2024-01-10T09:00:00.000Z',
  mergedAt: '2024-01-11T14:00:00.000Z',
  mergedBy: 'timneutkens',
  additions: 120,
  deletions: 30,
  reviews: [
    {
      id: 5001,
      reviewer: 'timneutkens',
      state: 'APPROVED',
      submittedAt: '2024-01-11T12:00:00.000Z',
      bodyLength: 45,
      inlineComments: 3,
    },
  ],
}

const fakeCommit: GitHubCommit = {
  sha: 'abc123def456',
  author: 'gaearon',
  authoredAt: '2024-01-10T08:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(fetchPullsWithReviews).mockResolvedValue({ prs: [fakePR], defaultBranch: 'main' })
  vi.mocked(fetchCommits).mockResolvedValue([fakeCommit])
})

afterEach(async () => {
  const db = getDb()
  await db.deleteFrom('reviews').execute()
  await db.deleteFrom('pulls').execute()
  await db.deleteFrom('commits').execute()
  await db.deleteFrom('sync_meta').execute()
  vi.resetAllMocks()
})

describe('syncRepo', () => {
  it('persists PRs, reviews, commits, and sync_meta to the database', async () => {
    const result = await syncRepo('vercel', 'next.js')

    const db = getDb()

    const pull = await db.selectFrom('pulls').where('id', '=', 1001).selectAll().executeTakeFirst()
    expect(pull?.author).toBe('gaearon')
    expect(pull?.additions).toBe(120)
    expect(pull?.merged_by).toBe('timneutkens')

    const review = await db.selectFrom('reviews').where('id', '=', 5001).selectAll().executeTakeFirst()
    expect(review?.state).toBe('APPROVED')
    expect(review?.inline_comments).toBe(3)

    const commit = await db.selectFrom('commits').where('sha', '=', 'abc123def456').selectAll().executeTakeFirst()
    expect(commit?.author).toBe('gaearon')

    const meta = await db
      .selectFrom('sync_meta')
      .where('owner', '=', 'vercel')
      .where('repo', '=', 'next.js')
      .selectAll()
      .executeTakeFirst()
    expect(meta?.synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(result.pullsFetched).toBe(1)
    expect(result.reviewsFetched).toBe(1)
    expect(result.commitsFetched).toBe(1)
  })

  it('throws SyncConflictError immediately when a sync is already in progress', async () => {
    let resolveFirstFetch!: (v: FetchPRsResult) => void
    vi.mocked(fetchPullsWithReviews).mockReturnValueOnce(
      new Promise<FetchPRsResult>((resolve) => { resolveFirstFetch = resolve }),
    )

    const inflight = syncRepo('vercel', 'next.js')

    await expect(syncRepo('vercel', 'next.js')).rejects.toThrow(SyncConflictError)

    resolveFirstFetch({ prs: [], defaultBranch: 'main' })
    await inflight
  })
})
