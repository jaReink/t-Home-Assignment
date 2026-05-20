import { useState } from 'react'
import type { ContributorsResult } from '../lib/api'

interface ContributorsTableProps {
  data: ContributorsResult | undefined
  isLoading: boolean
}

type SortKey = 'login' | 'pullsMerged' | 'commits' | 'linesAdded' | 'linesDeleted'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'login', label: 'Login' },
  { key: 'pullsMerged', label: 'PRs Merged' },
  { key: 'commits', label: 'Commits' },
  { key: 'linesAdded', label: 'Lines Added' },
  { key: 'linesDeleted', label: 'Lines Deleted' },
]

export default function ContributorsTable({ data, isLoading }: ContributorsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pullsMerged')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = data
    ? [...data.contributors].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        }
        const an = av as number
        const bn = bv as number
        return sortDir === 'asc' ? an - bn : bn - an
      })
    : []

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">Contributors</h2>
        {data && (
          <p className="text-xs text-gray-500 mt-0.5">{data.totalPrs} total PRs</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No contributors found for this period.
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.login} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.login}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.pullsMerged}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.commits}</td>
                  <td className="px-4 py-2.5 text-green-600">+{c.linesAdded.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-red-500">-{c.linesDeleted.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
