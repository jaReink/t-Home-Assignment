import type { Kysely } from 'kysely'
import type { DB } from '../db/types.js'

export interface ReviewerStats {
  login: string
  approvalsGiven: number
  silentApprovals: number
  silentApprovalRate: number
  changesRequested: number
}

export interface AuthorStats {
  login: string
  pullsMerged: number
  unreviewedMerges: number
  unreviewedMergeRate: number
}

export interface ReviewHealthResult {
  period: { from: string; to: string }
  repo: string
  totalMergedPrs: number
  overallSilentApprovalRate: number
  overallUnreviewedMergeRate: number
  reviewers: ReviewerStats[]
  authors: AuthorStats[]
}

export async function computeReviewHealth(
  db: Kysely<DB>,
  owner: string,
  repo: string,
  from: Date,
  to: Date,
): Promise<ReviewHealthResult> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const mergedPulls = await db
    .selectFrom('pulls')
    .select(['number', 'author'])
    .where('owner', '=', owner)
    .where('repo', '=', repo)
    .where('merged_at', '>=', fromIso)
    .where('merged_at', '<', toIso)
    .execute()

  const totalMergedPrs = mergedPulls.length

  if (totalMergedPrs === 0) {
    return {
      period: { from: fromIso, to: toIso },
      repo: `${owner}/${repo}`,
      totalMergedPrs: 0,
      overallSilentApprovalRate: 0,
      overallUnreviewedMergeRate: 0,
      reviewers: [],
      authors: [],
    }
  }

  // All reviews for PRs merged in the range, with the PR author joined so we can
  // distinguish external approvals from self-approvals in a single pass.
  const reviewRows = await db
    .selectFrom('reviews as r')
    .innerJoin('pulls as p', join =>
      join
        .onRef('p.owner', '=', 'r.owner')
        .onRef('p.repo', '=', 'r.repo')
        .onRef('p.number', '=', 'r.pull_number'),
    )
    .select([
      'r.pull_number',
      'r.reviewer',
      'r.state',
      'r.body_length',
      'r.inline_comments',
      'p.author as pr_author',
    ])
    .where('r.owner', '=', owner)
    .where('r.repo', '=', repo)
    .where('p.merged_at', '>=', fromIso)
    .where('p.merged_at', '<', toIso)
    .execute()

  // DISMISSED reviews are treated as no review per spec.
  const reviewerMap = new Map<string, { approvals: number; silent: number; changes: number }>()

  // A PR is externally approved only when at least one non-author APPROVED it.
  const externallyApproved = new Set<number>()

  for (const row of reviewRows) {
    if (row.state === 'APPROVED') {
      if (!reviewerMap.has(row.reviewer)) {
        reviewerMap.set(row.reviewer, { approvals: 0, silent: 0, changes: 0 })
      }
      const s = reviewerMap.get(row.reviewer)!
      s.approvals++
      // Silent: no inline comments and body under 10 chars (empty or a single word like "LGTM").
      if (row.body_length < 10 && row.inline_comments === 0) s.silent++

      if (row.reviewer !== row.pr_author) externallyApproved.add(row.pull_number)
    } else if (row.state === 'CHANGES_REQUESTED') {
      if (!reviewerMap.has(row.reviewer)) {
        reviewerMap.set(row.reviewer, { approvals: 0, silent: 0, changes: 0 })
      }
      reviewerMap.get(row.reviewer)!.changes++
    }
  }

  let totalApprovals = 0
  let totalSilent = 0
  for (const s of reviewerMap.values()) {
    totalApprovals += s.approvals
    totalSilent += s.silent
  }

  const authorMap = new Map<string, { merged: number; unreviewed: number }>()
  let unreviewedCount = 0

  for (const pull of mergedPulls) {
    if (!authorMap.has(pull.author)) authorMap.set(pull.author, { merged: 0, unreviewed: 0 })
    const s = authorMap.get(pull.author)!
    s.merged++
    if (!externallyApproved.has(pull.number)) {
      s.unreviewed++
      unreviewedCount++
    }
  }

  return {
    period: { from: fromIso, to: toIso },
    repo: `${owner}/${repo}`,
    totalMergedPrs,
    overallSilentApprovalRate: totalApprovals > 0 ? totalSilent / totalApprovals : 0,
    overallUnreviewedMergeRate: unreviewedCount / totalMergedPrs,
    reviewers: Array.from(reviewerMap.entries())
      .map(([login, s]) => ({
        login,
        approvalsGiven: s.approvals,
        silentApprovals: s.silent,
        silentApprovalRate: s.approvals > 0 ? s.silent / s.approvals : 0,
        changesRequested: s.changes,
      }))
      .sort((a, b) => b.approvalsGiven - a.approvalsGiven),
    authors: Array.from(authorMap.entries())
      .map(([login, s]) => ({
        login,
        pullsMerged: s.merged,
        unreviewedMerges: s.unreviewed,
        unreviewedMergeRate: s.unreviewed / s.merged,
      }))
      .sort((a, b) => b.pullsMerged - a.pullsMerged),
  }
}
