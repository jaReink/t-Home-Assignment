import { afterEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/client.js'
import { computePrTiming } from '../../src/insights/prTiming.js'

const OWNER = 'owner1'
const REPO = 'repo1'
const FROM = new Date('2024-01-01T00:00:00Z')
const TO = new Date('2024-02-01T00:00:00Z')

afterEach(async () => {
  const db = getDb()
  await db.deleteFrom('reviews').execute()
  await db.deleteFrom('pulls').execute()
})

describe('computePrTiming', () => {
  it('computes correct percentiles and bucket distribution from known pickup times', async () => {
    const db = getDb()

    await db.insertInto('pulls').values([
      // PR 1: 1h pickup → bucket '0–2h'
      { id: 1, owner: OWNER, repo: REPO, number: 1, author: 'author1', created_at: '2024-01-10T00:00:00Z', merged_at: '2024-01-10T12:00:00Z', merged_by: 'author1', additions: 10, deletions: 0 },
      // PR 2: 10h pickup → bucket '8–24h'
      { id: 2, owner: OWNER, repo: REPO, number: 2, author: 'author1', created_at: '2024-01-11T00:00:00Z', merged_at: '2024-01-11T23:00:00Z', merged_by: 'author1', additions: 10, deletions: 0 },
      // PR 3: 50h pickup → bucket '2d+'
      { id: 3, owner: OWNER, repo: REPO, number: 3, author: 'author2', created_at: '2024-01-12T00:00:00Z', merged_at: '2024-01-15T00:00:00Z', merged_by: 'author2', additions: 10, deletions: 0 },
    ]).execute()

    await db.insertInto('reviews').values([
      { id: 101, owner: OWNER, repo: REPO, pull_number: 1, reviewer: 'reviewer1', state: 'APPROVED', submitted_at: '2024-01-10T01:00:00Z', body_length: 20, inline_comments: 0 },
      { id: 102, owner: OWNER, repo: REPO, pull_number: 2, reviewer: 'reviewer1', state: 'APPROVED', submitted_at: '2024-01-11T10:00:00Z', body_length: 20, inline_comments: 0 },
      { id: 103, owner: OWNER, repo: REPO, pull_number: 3, reviewer: 'reviewer1', state: 'APPROVED', submitted_at: '2024-01-14T02:00:00Z', body_length: 20, inline_comments: 0 },
    ]).execute()

    const result = await computePrTiming(db, OWNER, REPO, FROM, TO)

    expect(result.totalPrsWithReview).toBe(3)

    // Sorted pickup hours: [1, 10, 50]
    // median = sorted[ceil(3*0.50)-1] = sorted[1] = 10
    // p75    = sorted[ceil(3*0.75)-1] = sorted[2] = 50
    // p95    = sorted[ceil(3*0.95)-1] = sorted[2] = 50
    expect(result.medianPickupHours).toBe(10)
    expect(result.p75PickupHours).toBe(50)
    expect(result.p95PickupHours).toBe(50)

    const byLabel = Object.fromEntries(result.buckets.map(b => [b.label, b]))
    expect(byLabel['0–2h'].count).toBe(1)
    expect(byLabel['8–24h'].count).toBe(1)
    expect(byLabel['2d+'].count).toBe(1)
    expect(byLabel['2–8h'].count).toBe(0)
    expect(byLabel['1–2d'].count).toBe(0)
  })

  it('excludes PRs with no reviews and returns zeros when no reviewed PRs exist', async () => {
    const db = getDb()

    await db.insertInto('pulls').values(
      { id: 10, owner: OWNER, repo: REPO, number: 10, author: 'author1', created_at: '2024-01-05T00:00:00Z', merged_at: '2024-01-06T00:00:00Z', merged_by: 'author1', additions: 5, deletions: 0 },
    ).execute()

    const result = await computePrTiming(db, OWNER, REPO, FROM, TO)

    expect(result.totalPrsWithReview).toBe(0)
    expect(result.medianPickupHours).toBe(0)
    expect(result.buckets.every(b => b.count === 0)).toBe(true)
  })
})
