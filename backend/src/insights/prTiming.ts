import type { Kysely } from 'kysely'
import type { DB } from '../db/types.js'

export interface TimingBucket {
  label: string
  count: number
  pct: number
}

export interface HourHeatmapEntry {
  hour: number
  count: number
}

export interface PrTimingResult {
  period: { from: string; to: string }
  repo: string
  totalPrsWithReview: number
  medianPickupHours: number
  p75PickupHours: number
  p95PickupHours: number
  buckets: TimingBucket[]
  hourOfDayHeatmap: HourHeatmapEntry[]
}

// Nearest-rank percentile on a pre-sorted array.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)]
}

const BUCKET_LABELS = ['0–2h', '2–8h', '8–24h', '1–2d', '2d+'] as const

function toBucket(hours: number): string {
  if (hours < 2) return '0–2h'
  if (hours < 8) return '2–8h'
  if (hours < 24) return '8–24h'
  if (hours < 48) return '1–2d'
  return '2d+'
}

export async function computePrTiming(
  db: Kysely<DB>,
  owner: string,
  repo: string,
  from: Date,
  to: Date,
): Promise<PrTimingResult> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  // Only PRs that have at least one review are included (innerJoin excludes the rest).
  const [pickupRows, reviewTimeRows] = await Promise.all([
    db
      .selectFrom('pulls as p')
      .innerJoin('reviews as r', join =>
        join
          .onRef('r.owner', '=', 'p.owner')
          .onRef('r.repo', '=', 'p.repo')
          .onRef('r.pull_number', '=', 'p.number'),
      )
      .select(eb => [
        'p.created_at',
        eb.fn.min('r.submitted_at').as('first_review_at'),
      ])
      .where('p.owner', '=', owner)
      .where('p.repo', '=', repo)
      .where('p.merged_at', '>=', fromIso)
      .where('p.merged_at', '<', toIso)
      .groupBy(['p.number', 'p.created_at'])
      .execute(),

    // Hour-of-day heatmap uses all review submissions, not just the first.
    db
      .selectFrom('reviews as r')
      .innerJoin('pulls as p', join =>
        join
          .onRef('p.owner', '=', 'r.owner')
          .onRef('p.repo', '=', 'r.repo')
          .onRef('p.number', '=', 'r.pull_number'),
      )
      .select('r.submitted_at')
      .where('r.owner', '=', owner)
      .where('r.repo', '=', repo)
      .where('p.merged_at', '>=', fromIso)
      .where('p.merged_at', '<', toIso)
      .execute(),
  ])

  const hourCounts = new Array<number>(24).fill(0)
  for (const row of reviewTimeRows) {
    hourCounts[new Date(row.submitted_at).getUTCHours()]++
  }
  const hourOfDayHeatmap: HourHeatmapEntry[] = hourCounts.map((count, hour) => ({ hour, count }))

  const emptyBuckets: TimingBucket[] = BUCKET_LABELS.map(label => ({ label, count: 0, pct: 0 }))

  if (pickupRows.length === 0) {
    return {
      period: { from: fromIso, to: toIso },
      repo: `${owner}/${repo}`,
      totalPrsWithReview: 0,
      medianPickupHours: 0,
      p75PickupHours: 0,
      p95PickupHours: 0,
      buckets: emptyBuckets,
      hourOfDayHeatmap,
    }
  }

  const pickupHours = pickupRows
    .map(row => (new Date(row.first_review_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000)
    .filter(h => h >= 0) // guard against clock skew producing negative deltas
    .sort((a, b) => a - b)

  const bucketCounts = new Map<string, number>(BUCKET_LABELS.map(l => [l, 0]))
  for (const h of pickupHours) {
    const label = toBucket(h)
    bucketCounts.set(label, (bucketCounts.get(label) ?? 0) + 1)
  }

  const total = pickupHours.length
  const buckets: TimingBucket[] = BUCKET_LABELS.map(label => {
    const count = bucketCounts.get(label) ?? 0
    return { label, count, pct: Math.round((count / total) * 100) }
  })

  return {
    period: { from: fromIso, to: toIso },
    repo: `${owner}/${repo}`,
    totalPrsWithReview: total,
    medianPickupHours: percentile(pickupHours, 0.5),
    p75PickupHours: percentile(pickupHours, 0.75),
    p95PickupHours: percentile(pickupHours, 0.95),
    buckets,
    hourOfDayHeatmap,
  }
}
