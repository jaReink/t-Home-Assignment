import { useCallback, useMemo } from 'react'
import { useContributors, useReviewHealth, usePrTiming, useNarrative } from './hooks/useInsights'
import type { InsightParams } from './lib/api'
import RepoForm from './components/RepoForm'
import ContributorsTable from './components/ContributorsTable'
import ReviewHealthPanel from './components/ReviewHealthPanel'
import PrTimingChart from './components/PrTimingChart'
import NarrativePanel from './components/NarrativePanel'

function getSearchParams(): {
  owner: string
  repo: string
  from: string
  to: string
} {
  const p = new URLSearchParams(window.location.search)
  return {
    owner: p.get('owner') ?? '',
    repo: p.get('repo') ?? '',
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
  }
}

export default function App() {
  const urlParams = getSearchParams()
  const hasParams =
    !!urlParams.owner && !!urlParams.repo && !!urlParams.from && !!urlParams.to

  const insightParams = useMemo<InsightParams>(() => {
    const fallback = new Date()
    return {
      owner: urlParams.owner || 'owner',
      repo: urlParams.repo || 'repo',
      from: urlParams.from ? new Date(urlParams.from) : fallback,
      to: urlParams.to ? new Date(urlParams.to) : fallback,
    }
  }, [urlParams.owner, urlParams.repo, urlParams.from, urlParams.to])

  const contributors = useContributors(insightParams, hasParams)
  const reviewHealth = useReviewHealth(insightParams, hasParams)
  const prTiming = usePrTiming(insightParams, hasParams)
  const narrative = useNarrative(insightParams, hasParams)

  const anyError =
    contributors.isError || reviewHealth.isError || prTiming.isError || narrative.isError

  const errorMessages = [
    contributors.error,
    reviewHealth.error,
    prTiming.error,
    narrative.error,
  ]
    .filter(Boolean)
    .map((e) => (e instanceof Error ? e.message : String(e)))

  const handleSubmit = useCallback((owner: string, repo: string, from: Date, to: Date) => {
    const params = new URLSearchParams({
      owner,
      repo,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    })
    window.location.search = params.toString()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">GitHub Insights</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <RepoForm onSubmit={handleSubmit} />

        {anyError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-red-800">One or more requests failed:</p>
            <ul className="mt-1 list-disc list-inside text-sm text-red-700">
              {errorMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {hasParams && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContributorsTable data={contributors.data} isLoading={contributors.isLoading} />
            <ReviewHealthPanel data={reviewHealth.data} isLoading={reviewHealth.isLoading} />
            <PrTimingChart data={prTiming.data} isLoading={prTiming.isLoading} />
            <NarrativePanel data={narrative.data} isLoading={narrative.isLoading} />
          </div>
        )}

        {!hasParams && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Enter an owner, repo, and date range above and click Analyze to load insights.
          </div>
        )}
      </main>
    </div>
  )
}
