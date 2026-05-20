import { afterEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/client.js'
import { computeContributors } from '../../src/insights/contributors.js'

const OWNER = 'owner1'
const REPO = 'repo1'
const FROM = new Date('2024-01-01T00:00:00Z')
const TO = new Date('2024-02-01T00:00:00Z')

afterEach(async () => {
  const db = getDb()
  await db.deleteFrom('commits').execute()
  await db.deleteFrom('reviews').execute()
  await db.deleteFrom('pulls').execute()
})

describe('computeContributors', () => {
  it('merges PR and commit data by author, including commit-only contributors', async () => {
    const db = getDb()

    await db.insertInto('pulls').values([
      { id: 1, owner: OWNER, repo: REPO, number: 1, author: 'author1', created_at: '2024-01-05T00:00:00Z', merged_at: '2024-01-10T00:00:00Z', merged_by: 'author1', additions: 100, deletions: 20 },
      { id: 2, owner: OWNER, repo: REPO, number: 2, author: 'author1', created_at: '2024-01-12T00:00:00Z', merged_at: '2024-01-15T00:00:00Z', merged_by: 'reviewer1', additions: 50, deletions: 5 },
      { id: 3, owner: OWNER, repo: REPO, number: 3, author: 'author2', created_at: '2024-01-18T00:00:00Z', merged_at: '2024-01-20T00:00:00Z', merged_by: 'author1', additions: 200, deletions: 80 },
    ]).execute()

    await db.insertInto('commits').values([
      { sha: 'c1', owner: OWNER, repo: REPO, author: 'author1',      authored_at: '2024-01-05T00:00:00Z' },
      { sha: 'c2', owner: OWNER, repo: REPO, author: 'author1',      authored_at: '2024-01-12T00:00:00Z' },
      { sha: 'c3', owner: OWNER, repo: REPO, author: 'author1',      authored_at: '2024-01-18T00:00:00Z' },
      { sha: 'c4', owner: OWNER, repo: REPO, author: 'author2',      authored_at: '2024-01-08T00:00:00Z' },
      // contributor1 has commits but no PRs — must still appear in the result
      { sha: 'c5', owner: OWNER, repo: REPO, author: 'contributor1', authored_at: '2024-01-25T00:00:00Z' },
    ]).execute()

    const result = await computeContributors(db, OWNER, REPO, FROM, TO)

    expect(result.totalPrs).toBe(3)

    const a1 = result.contributors.find(c => c.login === 'author1')!
    expect(a1.pullsMerged).toBe(2)
    expect(a1.commits).toBe(3)
    expect(a1.linesAdded).toBe(150)
    expect(a1.linesDeleted).toBe(25)

    const a2 = result.contributors.find(c => c.login === 'author2')!
    expect(a2.pullsMerged).toBe(1)
    expect(a2.commits).toBe(1)
    expect(a2.linesAdded).toBe(200)

    // contributor1 appears with no PRs — commit-only contributors must be included
    const c1 = result.contributors.find(c => c.login === 'contributor1')!
    expect(c1.pullsMerged).toBe(0)
    expect(c1.commits).toBe(1)
    expect(c1.linesAdded).toBe(0)
  })

  it('returns empty contributors and zero totalPrs when nothing falls in the range', async () => {
    const db = getDb()
    await db.insertInto('pulls').values(
      { id: 10, owner: OWNER, repo: REPO, number: 10, author: 'author1', created_at: '2023-06-01T00:00:00Z', merged_at: '2023-06-15T00:00:00Z', merged_by: 'author1', additions: 10, deletions: 2 },
    ).execute()

    const result = await computeContributors(db, OWNER, REPO, FROM, TO)

    expect(result.totalPrs).toBe(0)
    expect(result.contributors).toHaveLength(0)
  })
})
