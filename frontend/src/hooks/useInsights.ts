import { useQuery } from '@tanstack/react-query'
import {
  fetchContributors,
  fetchReviewHealth,
  fetchPrTiming,
  fetchNarrative,
  type InsightParams,
} from '../lib/api'

function insightQueryKey(endpoint: string, params: InsightParams) {
  return [
    endpoint,
    params.owner,
    params.repo,
    params.from.toISOString(),
    params.to.toISOString(),
  ]
}

export function useContributors(params: InsightParams, enabled: boolean) {
  return useQuery({
    queryKey: insightQueryKey('contributors', params),
    queryFn: () => fetchContributors(params),
    enabled,
  })
}

export function useReviewHealth(params: InsightParams, enabled: boolean) {
  return useQuery({
    queryKey: insightQueryKey('review-health', params),
    queryFn: () => fetchReviewHealth(params),
    enabled,
  })
}

export function usePrTiming(params: InsightParams, enabled: boolean) {
  return useQuery({
    queryKey: insightQueryKey('pr-timing', params),
    queryFn: () => fetchPrTiming(params),
    enabled,
  })
}

export function useNarrative(params: InsightParams, enabled: boolean) {
  return useQuery({
    queryKey: insightQueryKey('narrative', params),
    queryFn: () => fetchNarrative(params),
    enabled,
  })
}
