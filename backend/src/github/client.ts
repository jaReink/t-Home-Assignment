import { z } from 'zod'
import { config } from '../config.js'
import { FetchPRsResult, GitHubCommit, GitHubError, GitHubPR, GitHubReview, RateLimitError } from './types.js'

// Buffer ensures we capture PRs created just before the window but merged within it.
// Not configurable — it's an implementation detail, not a user concern.
const LOOKBACK_BUFFER_DAYS = 30

// ---------------------------------------------------------------------------
// Zod schemas — validate the external API response shape at the boundary.
// If GitHub renames a field, we get a clear parse error rather than a silent
// undefined buried in transform logic.
// ---------------------------------------------------------------------------

const RawReviewNodeSchema = z.object({
  databaseId: z.number(),
  author: z.object({ login: z.string() }).nullable(),
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED']),
  submittedAt: z.string(),
  body: z.string().nullable(),
  comments: z.object({ totalCount: z.number() }),
})

const RawPRNodeSchema = z.object({
  databaseId: z.number(),
  number: z.number(),
  author: z.object({ login: z.string() }).nullable(),
  createdAt: z.string(),
  mergedAt: z.string(),
  mergedBy: z.object({ login: z.string() }).nullable(),
  additions: z.number(),
  deletions: z.number(),
  reviews: z.object({ nodes: z.array(RawReviewNodeSchema) }),
})

const PullsQueryResponseSchema = z.object({
  rateLimit: z.object({ remaining: z.number(), resetAt: z.string() }),
  repository: z.object({
    defaultBranchRef: z.object({ name: z.string() }).nullable(),
    pullRequests: z.object({
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string() }),
      nodes: z.array(RawPRNodeSchema),
    }),
  }),
})

const CommitRestResponseSchema = z.array(
  z.object({
    sha: z.string(),
    author: z.object({ login: z.string() }).nullable(),
    commit: z.object({ author: z.object({ date: z.string() }) }),
  }),
)

type RawReviewNode = z.infer<typeof RawReviewNodeSchema>
type RawPRNode = z.infer<typeof RawPRNodeSchema>
type PullsQueryResponse = z.infer<typeof PullsQueryResponseSchema>

const PULLS_QUERY = `
  query($owner: String!, $repo: String!, $after: String) {
    rateLimit { remaining resetAt }
    repository(owner: $owner, name: $repo) {
      defaultBranchRef { name }
      pullRequests(
        first: 100
        after: $after
        states: [MERGED]
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          databaseId
          number
          author { login }
          createdAt
          mergedAt
          mergedBy { login }
          additions
          deletions
          reviews(first: 50) {
            nodes {
              databaseId
              author { login }
              state
              submittedAt
              body
              comments { totalCount }
            }
          }
        }
      }
    }
  }
`

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function graphql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(config.GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    if (res.status === 401) throw new GitHubError('Invalid GitHub token', 401)
    if (res.status === 403) {
      const reset = res.headers.get('X-RateLimit-Reset')
      if (reset) throw new RateLimitError(new Date(Number(reset) * 1000))
      throw new GitHubError('GitHub API forbidden', 403)
    }
    throw new GitHubError(`GitHub GraphQL error: ${res.status}`, res.status)
  }

  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] }
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join(', ')
    if (msg.toLowerCase().includes('could not resolve')) throw new GitHubError(msg, 404)
    throw new GitHubError(msg, 500)
  }

  return json.data
}

function transformReview(node: RawReviewNode): GitHubReview | null {
  if (!node.author) return null
  return {
    id: node.databaseId,
    reviewer: node.author.login,
    state: node.state,
    submittedAt: node.submittedAt,
    bodyLength: (node.body ?? '').trim().length,
    inlineComments: node.comments.totalCount,
  }
}

function transformPR(node: RawPRNode): GitHubPR | null {
  if (!node.author) return null
  return {
    id: node.databaseId,
    number: node.number,
    author: node.author.login,
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    mergedBy: node.mergedBy?.login ?? null,
    additions: node.additions,
    deletions: node.deletions,
    reviews: node.reviews.nodes.flatMap((r) => {
      const review = transformReview(r)
      return review ? [review] : []
    }),
  }
}

export async function fetchPullsWithReviews(
  owner: string,
  repo: string,
  lookbackMonths: number = config.SYNC_LOOKBACK_MONTHS,
): Promise<FetchPRsResult> {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - lookbackMonths)
  cutoff.setDate(cutoff.getDate() - LOOKBACK_BUFFER_DAYS)

  const prs: GitHubPR[] = []
  let after: string | null = null
  let defaultBranch = 'main'

  while (true) {
    const raw = await graphql(PULLS_QUERY, { owner, repo, after })
    const data: PullsQueryResponse = PullsQueryResponseSchema.parse(raw)

    if (data.rateLimit.remaining < 10) {
      throw new RateLimitError(new Date(data.rateLimit.resetAt))
    }

    // Capture on first page; null means an empty/unborn repo — fall back to 'main'
    if (after === null) {
      defaultBranch = data.repository.defaultBranchRef?.name ?? 'main'
    }

    const { nodes, pageInfo } = data.repository.pullRequests

    for (const node of nodes) {
      const pr = transformPR(node)
      if (pr) prs.push(pr)
    }

    if (!pageInfo.hasNextPage) break

    const oldest = nodes[nodes.length - 1]
    if (oldest && new Date(oldest.createdAt) < cutoff) break

    after = pageInfo.endCursor
  }

  return { prs, defaultBranch }
}

export async function fetchCommits(
  owner: string,
  repo: string,
  branch: string,
  lookbackMonths: number = config.SYNC_LOOKBACK_MONTHS,
): Promise<GitHubCommit[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - lookbackMonths)
  since.setDate(since.getDate() - LOOKBACK_BUFFER_DAYS)

  const results: GitHubCommit[] = []
  let page = 1

  while (true) {
    const url = new URL(`${config.GITHUB_REST_URL}/repos/${owner}/${repo}/commits`)
    url.searchParams.set('sha', branch)
    url.searchParams.set('since', since.toISOString())
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))

    const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(30_000) })

    if (!res.ok) {
      if (res.status === 404) throw new GitHubError(`Repo ${owner}/${repo} not found`, 404)
      if (res.status === 409) break // GitHub returns 409 for repos with no commits
      const remaining = res.headers.get('X-RateLimit-Remaining')
      const reset = res.headers.get('X-RateLimit-Reset')
      if (remaining === '0' && reset) throw new RateLimitError(new Date(Number(reset) * 1000))
      throw new GitHubError(`GitHub commits error: ${res.status}`, res.status)
    }

    const remaining = res.headers.get('X-RateLimit-Remaining')
    const reset = res.headers.get('X-RateLimit-Reset')
    if (remaining !== null && Number(remaining) < 10 && reset) {
      throw new RateLimitError(new Date(Number(reset) * 1000))
    }

    const commits = CommitRestResponseSchema.parse(await res.json())

    if (commits.length === 0) break

    for (const c of commits) {
      if (!c.author) continue
      results.push({ sha: c.sha, author: c.author.login, authoredAt: c.commit.author.date })
    }

    if (commits.length < 100) break
    page++
  }

  return results
}
