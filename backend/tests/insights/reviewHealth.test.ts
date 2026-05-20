import { afterEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/db/client.js'
import { computeReviewHealth } from '../../src/insights/reviewHealth.js'

const OWNER = 'owner1'
const REPO = 'repo1'
const FROM = new Date('2024-01-01T00:00:00Z')
const TO = new Date('2024-02-01T00:00:00Z')

afterEach(async () => {
  const db = getDb()
  await db.deleteFrom('reviews').execute()
  await db.deleteFrom('pulls').execute()
})

describe('computeReviewHealth', () => {
  it('correctly classifies substantive vs silent approvals and unreviewed merges', async () => {
    const db = getDb()

    await db.insertInto('pulls').values([
      // PR 1: approved by reviewer1 with substantive review → not silent, not unreviewed
      { id: 1, owner: OWNER, repo: REPO, number: 1, author: 'author1', created_at: '2024-01-02T00:00:00Z', merged_at: '2024-01-05T00:00:00Z', merged_by: 'author1', additions: 10, deletions: 2 },
      // PR 2: approved by reviewer2 with silent review → silent, not unreviewed
      { id: 2, owner: OWNER, repo: REPO, number: 2, author: 'author1', created_at: '2024-01-06T00:00:00Z', merged_at: '2024-01-08T00:00:00Z', merged_by: 'author1', additions: 20, deletions: 3 },
      // PR 3: only a COMMENTED review → no approval at all → unreviewed merge
      { id: 3, owner: OWNER, repo: REPO, number: 3, author: 'author2', created_at: '2024-01-10T00:00:00Z', merged_at: '2024-01-12T00:00:00Z', merged_by: 'author2', additions: 5, deletions: 1 },
    ]).execute()

    await db.insertInto('reviews').values([
      { id: 101, owner: OWNER, repo: REPO, pull_number: 1, reviewer: 'reviewer1', state: 'APPROVED',   submitted_at: '2024-01-04T00:00:00Z', body_length: 80, inline_comments: 5 },
      { id: 102, owner: OWNER, repo: REPO, pull_number: 2, reviewer: 'reviewer2', state: 'APPROVED',   submitted_at: '2024-01-07T00:00:00Z', body_length: 0,  inline_comments: 0 },
      { id: 103, owner: OWNER, repo: REPO, pull_number: 3, reviewer: 'reviewer1', state: 'COMMENTED',  submitted_at: '2024-01-11T00:00:00Z', body_length: 30, inline_comments: 0 },
    ]).execute()

    const result = await computeReviewHealth(db, OWNER, REPO, FROM, TO)

    expect(result.totalMergedPrs).toBe(3)
    expect(result.overallSilentApprovalRate).toBeCloseTo(0.5)   // 1 silent / 2 approvals
    expect(result.overallUnreviewedMergeRate).toBeCloseTo(1 / 3) // PR 3 only

    const r1 = result.reviewers.find(r => r.login === 'reviewer1')!
    expect(r1.approvalsGiven).toBe(1)
    expect(r1.silentApprovals).toBe(0)

    const r2 = result.reviewers.find(r => r.login === 'reviewer2')!
    expect(r2.approvalsGiven).toBe(1)
    expect(r2.silentApprovals).toBe(1)
    expect(r2.silentApprovalRate).toBe(1)

    const a2 = result.authors.find(a => a.login === 'author2')!
    expect(a2.unreviewedMerges).toBe(1)
    expect(a2.unreviewedMergeRate).toBe(1)
  })

  it('counts a self-approval as unreviewed — only external approvals satisfy the check', async () => {
    const db = getDb()

    await db.insertInto('pulls').values(
      { id: 10, owner: OWNER, repo: REPO, number: 10, author: 'author1', created_at: '2024-01-02T00:00:00Z', merged_at: '2024-01-03T00:00:00Z', merged_by: 'author1', additions: 5, deletions: 0 },
    ).execute()

    await db.insertInto('reviews').values(
      { id: 201, owner: OWNER, repo: REPO, pull_number: 10, reviewer: 'author1', state: 'APPROVED', submitted_at: '2024-01-02T12:00:00Z', body_length: 0, inline_comments: 0 },
    ).execute()

    const result = await computeReviewHealth(db, OWNER, REPO, FROM, TO)

    // Self-approval appears in reviewer stats (they did click approve)
    const selfReviewer = result.reviewers.find(r => r.login === 'author1')!
    expect(selfReviewer.approvalsGiven).toBe(1)

    // But it does NOT satisfy the external-approval requirement
    expect(result.overallUnreviewedMergeRate).toBe(1)
    expect(result.authors.find(a => a.login === 'author1')!.unreviewedMerges).toBe(1)
  })
})
