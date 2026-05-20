import { config } from '../config.js'
import { getDb } from '../db/client.js'
import { fetchCommits, fetchPullsWithReviews } from '../github/client.js'

export interface SyncResult {
  owner: string
  repo: string
  syncedAt: string
  pullsFetched: number
  reviewsFetched: number
  commitsFetched: number
}

export class SyncConflictError extends Error {
  constructor(owner: string, repo: string) {
    super(`Sync already in progress for ${owner}/${repo}`)
    this.name = 'SyncConflictError'
  }
}

// In-memory lock — prevents duplicate concurrent syncs for the same repo.
const syncInProgress = new Set<string>()

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`
}

export async function getSyncStatus(
  owner: string,
  repo: string,
): Promise<{ syncing: boolean; lastSyncedAt: string | null }> {
  const syncing = syncInProgress.has(repoKey(owner, repo))
  const meta = await getDb()
    .selectFrom('sync_meta')
    .select('synced_at')
    .where('owner', '=', owner)
    .where('repo', '=', repo)
    .executeTakeFirst()

  return { syncing, lastSyncedAt: meta?.synced_at ?? null }
}

export async function syncRepo(
  owner: string,
  repo: string,
  lookbackMonths?: number,
): Promise<SyncResult> {
  const key = repoKey(owner, repo)
  if (syncInProgress.has(key)) throw new SyncConflictError(owner, repo)

  syncInProgress.add(key)
  try {
    return await runSync(owner, repo, lookbackMonths)
  } finally {
    syncInProgress.delete(key)
  }
}

async function runSync(owner: string, repo: string, lookbackMonths?: number): Promise<SyncResult> {
  const { prs, defaultBranch } = await fetchPullsWithReviews(owner, repo, lookbackMonths)
  const commits = await fetchCommits(owner, repo, defaultBranch, lookbackMonths)

  const db = getDb()
  const syncedAt = new Date().toISOString()
  let reviewsFetched = 0

  await db.transaction().execute(async (trx) => {
    for (const pr of prs) {
      await trx
        .insertInto('pulls')
        .values({
          id: pr.id,
          owner,
          repo,
          number: pr.number,
          author: pr.author,
          created_at: pr.createdAt,
          merged_at: pr.mergedAt ?? null,
          merged_by: pr.mergedBy ?? null,
          additions: pr.additions,
          deletions: pr.deletions,
        })
        .onConflict(oc =>
          oc.column('id').doUpdateSet(eb => ({
            owner: eb.ref('excluded.owner'),
            repo: eb.ref('excluded.repo'),
            number: eb.ref('excluded.number'),
            author: eb.ref('excluded.author'),
            created_at: eb.ref('excluded.created_at'),
            merged_at: eb.ref('excluded.merged_at'),
            merged_by: eb.ref('excluded.merged_by'),
            additions: eb.ref('excluded.additions'),
            deletions: eb.ref('excluded.deletions'),
          })),
        )
        .execute()

      for (const review of pr.reviews) {
        await trx
          .insertInto('reviews')
          .values({
            id: review.id,
            owner,
            repo,
            pull_number: pr.number,
            reviewer: review.reviewer,
            state: review.state,
            submitted_at: review.submittedAt,
            body_length: review.bodyLength,
            inline_comments: review.inlineComments,
          })
          .onConflict(oc =>
            oc.column('id').doUpdateSet(eb => ({
              owner: eb.ref('excluded.owner'),
              repo: eb.ref('excluded.repo'),
              pull_number: eb.ref('excluded.pull_number'),
              reviewer: eb.ref('excluded.reviewer'),
              state: eb.ref('excluded.state'),
              submitted_at: eb.ref('excluded.submitted_at'),
              body_length: eb.ref('excluded.body_length'),
              inline_comments: eb.ref('excluded.inline_comments'),
            })),
          )
          .execute()

        reviewsFetched++
      }
    }

    for (const commit of commits) {
      await trx
        .insertInto('commits')
        .values({
          sha: commit.sha,
          owner,
          repo,
          author: commit.author,
          authored_at: commit.authoredAt,
        })
        .onConflict(oc =>
          oc.column('sha').doUpdateSet(eb => ({
            owner: eb.ref('excluded.owner'),
            repo: eb.ref('excluded.repo'),
            author: eb.ref('excluded.author'),
            authored_at: eb.ref('excluded.authored_at'),
          })),
        )
        .execute()
    }

    await trx
      .insertInto('sync_meta')
      .values({ owner, repo, synced_at: syncedAt })
      .onConflict(oc =>
        oc.columns(['owner', 'repo']).doUpdateSet(eb => ({
          synced_at: eb.ref('excluded.synced_at'),
        })),
      )
      .execute()
  })

  return {
    owner,
    repo,
    syncedAt,
    pullsFetched: prs.length,
    reviewsFetched,
    commitsFetched: commits.length,
  }
}

export async function ensureSynced(owner: string, repo: string): Promise<void> {
  const key = repoKey(owner, repo)
  if (syncInProgress.has(key)) return

  const meta = await getDb()
    .selectFrom('sync_meta')
    .select('synced_at')
    .where('owner', '=', owner)
    .where('repo', '=', repo)
    .executeTakeFirst()

  if (!meta) {
    await syncRepo(owner, repo)
    return
  }

  const ageMs = Date.now() - new Date(meta.synced_at).getTime()
  const ttlMs = config.CACHE_TTL_MINUTES * 60 * 1000
  if (ageMs > ttlMs) {
    await syncRepo(owner, repo)
  }
}
