import { useState } from 'react'
import type { ReviewHealthResult } from '../lib/api'

interface ReviewHealthPanelProps {
  data: ReviewHealthResult | undefined
  isLoading: boolean
}

function rateColor(rate: number): string {
  if (rate < 0.2) return 'bg-green-100 text-green-800 border-green-200'
  if (rate < 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}

export default function ReviewHealthPanel({ data, isLoading }: ReviewHealthPanelProps) {
  const [reviewerOpen, setReviewerOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-32" />
        <div className="flex gap-3">
          <div className="h-16 bg-gray-200 rounded animate-pulse flex-1" />
          <div className="h-16 bg-gray-200 rounded animate-pulse flex-1" />
        </div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">Review Health</h2>
        {data && (
          <p className="text-xs text-gray-500 mt-0.5">{data.totalMergedPrs} merged PRs</p>
        )}
      </div>
      <div className="p-4 space-y-4">
        {data ? (
          <>
            <div className="flex gap-3">
              <div
                className={`flex-1 border rounded-lg p-3 text-center ${rateColor(data.overallSilentApprovalRate)}`}
              >
                <div className="text-2xl font-bold">{pct(data.overallSilentApprovalRate)}</div>
                <div className="text-xs font-medium mt-0.5">Silent Approvals</div>
              </div>
              <div
                className={`flex-1 border rounded-lg p-3 text-center ${rateColor(data.overallUnreviewedMergeRate)}`}
              >
                <div className="text-2xl font-bold">{pct(data.overallUnreviewedMergeRate)}</div>
                <div className="text-xs font-medium mt-0.5">Unreviewed Merges</div>
              </div>
            </div>

            <button
              onClick={() => setReviewerOpen((o) => !o)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {reviewerOpen ? '▾' : '▸'} Reviewer breakdown
            </button>

            {reviewerOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Reviewer</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Approvals</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Silent</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Silent %</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Changes Req.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.reviewers.map((r) => (
                      <tr key={r.login} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{r.login}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.approvalsGiven}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.silentApprovals}</td>
                        <td className={`px-3 py-2 text-right font-medium ${r.silentApprovalRate >= 0.5 ? 'text-red-600' : r.silentApprovalRate >= 0.2 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {pct(r.silentApprovalRate)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.changesRequested}</td>
                      </tr>
                    ))}
                    {data.reviewers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                          No reviewer data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">No data available.</p>
        )}
      </div>
    </div>
  )
}
