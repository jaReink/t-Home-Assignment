import type { Kysely } from 'kysely'
import type { DB } from '../db/types.js'

export interface ContributorEntry {
  login: string
  commits: number
  pullsMerged: number
  linesAdded: number
  linesDeleted: number
}

export interface ContributorsResult {
  period: { from: string; to: string }
  repo: string
  totalPrs: number
  contributors: ContributorEntry[]
}

export async function computeContributors(
  db: Kysely<DB>,
  owner: string,
  repo: string,
  from: Date,
  to: Date,
): Promise<ContributorsResult> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const [pullRows, commitRows, { total }] = await Promise.all([
    db
      .selectFrom('pulls')
      .select(eb => [
        'author',
        eb.fn.count<number>('id').as('pulls_merged'),
        eb.fn.sum<number>('additions').as('lines_added'),
        eb.fn.sum<number>('deletions').as('lines_deleted'),
      ])
      .where('owner', '=', owner)
      .where('repo', '=', repo)
      .where('merged_at', '>=', fromIso)
      .where('merged_at', '<', toIso)
      .groupBy('author')
      .execute(),

    db
      .selectFrom('commits')
      .select(eb => ['author', eb.fn.count<number>('sha').as('commit_count')])
      .where('owner', '=', owner)
      .where('repo', '=', repo)
      .where('authored_at', '>=', fromIso)
      .where('authored_at', '<', toIso)
      .groupBy('author')
      .execute(),

    db
      .selectFrom('pulls')
      .select(eb => eb.fn.count<number>('id').as('total'))
      .where('owner', '=', owner)
      .where('repo', '=', repo)
      .where('merged_at', '>=', fromIso)
      .where('merged_at', '<', toIso)
      .executeTakeFirstOrThrow(),
  ])

  const map = new Map<string, ContributorEntry>()

  for (const row of pullRows) {
    map.set(row.author, {
      login: row.author,
      commits: 0,
      pullsMerged: row.pulls_merged,
      linesAdded: row.lines_added ?? 0,
      linesDeleted: row.lines_deleted ?? 0,
    })
  }

  for (const row of commitRows) {
    const entry = map.get(row.author)
    if (entry) {
      entry.commits = row.commit_count
    } else {
      // Commit-only contributor — no PRs in the period but still active. Must appear in results.
      map.set(row.author, {
        login: row.author,
        commits: row.commit_count,
        pullsMerged: 0,
        linesAdded: 0,
        linesDeleted: 0,
      })
    }
  }

  const contributors = Array.from(map.values()).sort(
    (a, b) => b.pullsMerged - a.pullsMerged || b.commits - a.commits,
  )

  return { period: { from: fromIso, to: toIso }, repo: `${owner}/${repo}`, totalPrs: total, contributors }
}
