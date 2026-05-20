CREATE TABLE IF NOT EXISTS pulls (
  id          INTEGER PRIMARY KEY,
  owner       TEXT NOT NULL,
  repo        TEXT NOT NULL,
  number      INTEGER NOT NULL,
  author      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  merged_at   TEXT,
  merged_by   TEXT,
  additions   INTEGER NOT NULL DEFAULT 0,
  deletions   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner, repo, number)
);

CREATE TABLE IF NOT EXISTS reviews (
  id              INTEGER PRIMARY KEY,
  owner           TEXT NOT NULL,
  repo            TEXT NOT NULL,
  pull_number     INTEGER NOT NULL,
  reviewer        TEXT NOT NULL,
  state           TEXT NOT NULL,
  submitted_at    TEXT NOT NULL,
  body_length     INTEGER NOT NULL DEFAULT 0,
  inline_comments INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner, repo, id),
  -- CASCADE required: INSERT OR REPLACE on pulls deletes then re-inserts the row,
  -- which would orphan reviews without it.
  FOREIGN KEY (owner, repo, pull_number) REFERENCES pulls(owner, repo, number) ON DELETE CASCADE
);

-- Commits: author + date only; lines come from PR data
CREATE TABLE IF NOT EXISTS commits (
  sha         TEXT PRIMARY KEY,
  owner       TEXT NOT NULL,
  repo        TEXT NOT NULL,
  author      TEXT NOT NULL,
  authored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  owner     TEXT NOT NULL,
  repo      TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY(owner, repo)
);

CREATE INDEX IF NOT EXISTS idx_pulls_repo_merged     ON pulls(owner, repo, merged_at);
-- Covers state-filtered approval checks without hitting the table rows
CREATE INDEX IF NOT EXISTS idx_reviews_approval      ON reviews(owner, repo, pull_number, state, reviewer);
CREATE INDEX IF NOT EXISTS idx_commits_repo_author   ON commits(owner, repo, authored_at);
