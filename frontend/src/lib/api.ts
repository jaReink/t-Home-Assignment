import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

export interface ContributorsResult {
  period: { from: string; to: string }
  repo: string
  totalPrs: number
  contributors: Array<{
    login: string
    commits: number
    pullsMerged: number
    linesAdded: number
    linesDeleted: number
  }>
}

export interface ReviewHealthResult {
  period: { from: string; to: string }
  repo: string
  totalMergedPrs: number
  overallSilentApprovalRate: number
  overallUnreviewedMergeRate: number
  reviewers: Array<{
    login: string
    approvalsGiven: number
    silentApprovals: number
    silentApprovalRate: number
    changesRequested: number
  }>
  authors: Array<{
    login: string
    pullsMerged: number
    unreviewedMerges: number
    unreviewedMergeRate: number
  }>
}

export interface PrTimingResult {
  period: { from: string; to: string }
  repo: string
  totalPrsWithReview: number
  medianPickupHours: number
  p75PickupHours: number
  p95PickupHours: number
  buckets: Array<{ label: string; count: number; pct: number }>
  hourOfDayHeatmap: Array<{ hour: number; count: number }>
}

export interface NarrativeResponse {
  headline: string
  narrative: string
  hypothesis: string | null
  confidence: number
  signals: Array<{ observation: string; dataPoint: string; interpretation: string }>
  caveat: string | null
  generatedAt: string
  stub: boolean
}

export interface SyncResult {
  pullsFetched: number
  reviewsFetched: number
  commitsFetched: number
  syncedAt: string
}

export interface SyncStatus {
  syncing: boolean
  lastSyncedAt: string | null
}

export interface InsightParams {
  owner: string
  repo: string
  from: Date
  to: Date
}

function toQueryParams(params: InsightParams) {
  return {
    owner: params.owner,
    repo: params.repo,
    from: params.from.toISOString(),
    to: params.to.toISOString(),
  }
}

export async function fetchContributors(params: InsightParams): Promise<ContributorsResult> {
  const { data } = await apiClient.get<ContributorsResult>('/api/contributors', {
    params: toQueryParams(params),
  })
  return data
}

export async function fetchReviewHealth(params: InsightParams): Promise<ReviewHealthResult> {
  const { data } = await apiClient.get<ReviewHealthResult>('/api/review-health', {
    params: toQueryParams(params),
  })
  return data
}

export async function fetchPrTiming(params: InsightParams): Promise<PrTimingResult> {
  const { data } = await apiClient.get<PrTimingResult>('/api/pr-timing', {
    params: toQueryParams(params),
  })
  return data
}

export async function fetchNarrative(params: InsightParams): Promise<NarrativeResponse> {
  const { data } = await apiClient.get<NarrativeResponse>('/api/narrative', {
    params: toQueryParams(params),
  })
  return data
}

export async function triggerSync(
  owner: string,
  repo: string,
  lookbackMonths?: number,
): Promise<SyncResult> {
  const { data } = await apiClient.post<SyncResult>('/api/sync', {
    owner,
    repo,
    lookbackMonths,
  })
  return data
}

export async function fetchSyncStatus(owner: string, repo: string): Promise<SyncStatus> {
  const { data } = await apiClient.get<SyncStatus>('/api/sync/status', {
    params: { owner, repo },
  })
  return data
}
