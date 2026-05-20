export interface FetchPRsResult {
  prs: GitHubPR[]
  defaultBranch: string
}

export interface GitHubPR {
  id: number
  number: number
  author: string
  createdAt: string
  mergedAt: string
  mergedBy: string | null
  additions: number
  deletions: number
  reviews: GitHubReview[]
}

export interface GitHubReview {
  id: number
  reviewer: string
  // DISMISSED = a prior APPROVED/CHANGES_REQUESTED was invalidated (e.g. after force-push).
  // Treat the same as no review: exclude from approval and silent-approval counts.
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string
  bodyLength: number
  inlineComments: number
}

export interface GitHubCommit {
  sha: string
  author: string
  authoredAt: string
}

export class GitHubError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message)
    this.name = 'GitHubError'
  }
}

export class RateLimitError extends Error {
  constructor(public readonly resetAt: Date) {
    super(`GitHub rate limit exceeded. Resets at ${resetAt.toISOString()}`)
    this.name = 'RateLimitError'
  }
}
