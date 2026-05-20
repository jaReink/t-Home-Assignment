import { useEffect, useState } from 'react'

interface RepoFormProps {
  onSubmit: (owner: string, repo: string, from: Date, to: Date) => void
}

const MAX_RANGE_DAYS = 365

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function RepoForm({ onSubmit }: RepoFormProps) {
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill from URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('owner')) setOwner(params.get('owner')!)
    if (params.get('repo')) setRepo(params.get('repo')!)
    if (params.get('from')) setFrom(params.get('from')!)
    if (params.get('to')) setTo(params.get('to')!)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedOwner = owner.trim()
    const trimmedRepo = repo.trim()

    if (!trimmedOwner) {
      setError('Owner cannot be empty.')
      return
    }
    if (!trimmedRepo) {
      setError('Repo cannot be empty.')
      return
    }
    if (!from || !to) return

    const fromDate = new Date(from)
    const toDate = new Date(to)

    if (fromDate >= toDate) {
      setError('"From" date must be before "To" date.')
      return
    }

    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > MAX_RANGE_DAYS) {
      setError(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`)
      return
    }

    setError(null)
    onSubmit(trimmedOwner, trimmedRepo, fromDate, toDate)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label htmlFor="rf-owner" className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</label>
          <input
            id="rf-owner"
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. facebook"
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label htmlFor="rf-repo" className="text-xs font-medium text-gray-500 uppercase tracking-wide">Repo</label>
          <input
            id="rf-repo"
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="e.g. react"
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rf-from" className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</label>
          <input
            id="rf-from"
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setError(null) }}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rf-to" className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</label>
          <input
            id="rf-to"
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setError(null) }}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2 rounded transition-colors"
        >
          Analyze
        </button>
      </form>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
