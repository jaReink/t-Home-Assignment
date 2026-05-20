// All *_at fields are ISO 8601 strings — SQLite has no native date type and
// better-sqlite3 returns whatever was stored. Kysely sees them as strings too.
export interface DB {
  pulls: PullsTable
  reviews: ReviewsTable
  commits: CommitsTable
  sync_meta: SyncMetaTable
}

export interface PullsTable {
  id: number
  owner: string
  repo: string
  number: number
  author: string
  created_at: string
  merged_at: string | null
  merged_by: string | null
  additions: number
  deletions: number
}

export interface ReviewsTable {
  id: number
  owner: string
  repo: string
  pull_number: number
  reviewer: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submitted_at: string
  body_length: number
  inline_comments: number
}

export interface CommitsTable {
  sha: string
  owner: string
  repo: string
  author: string
  authored_at: string
}

export interface SyncMetaTable {
  owner: string
  repo: string
  synced_at: string
}
