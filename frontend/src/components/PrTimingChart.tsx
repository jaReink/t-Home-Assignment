import type { PrTimingResult } from '../lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface PrTimingChartProps {
  data: PrTimingResult | undefined
  isLoading: boolean
}

function fmtHours(h: number): string {
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export default function PrTimingChart({ data, isLoading }: PrTimingChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-32" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse w-24" />
          ))}
        </div>
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">PR Pickup Time</h2>
        {data && (
          <p className="text-xs text-gray-500 mt-0.5">{data.totalPrsWithReview} PRs with review</p>
        )}
      </div>
      <div className="p-4 space-y-5">
        {data ? (
          <>
            {/* Percentile stats */}
            <div className="flex gap-4 flex-wrap">
              {[
                { label: 'Median', value: data.medianPickupHours },
                { label: 'p75', value: data.p75PickupHours },
                { label: 'p95', value: data.p95PickupHours },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-center min-w-[70px]"
                >
                  <div className="text-lg font-bold text-gray-900">{fmtHours(value)}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Bucket distribution */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Distribution
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.buckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Hour-of-day heatmap */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Reviews by Hour of Day
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={data.hourOfDayHeatmap}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(h) => `${h}:00`}
                    interval={3}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">No timing data available.</p>
        )}
      </div>
    </div>
  )
}
