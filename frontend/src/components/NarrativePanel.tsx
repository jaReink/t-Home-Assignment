import { useState } from 'react'
import type { NarrativeResponse } from '../lib/api'

interface NarrativePanelProps {
  data: NarrativeResponse | undefined
  isLoading: boolean
}

function confidenceColor(c: number): string {
  if (c > 0.7) return 'bg-green-500'
  if (c >= 0.4) return 'bg-yellow-400'
  return 'bg-red-500'
}

export default function NarrativePanel({ data, isLoading }: NarrativePanelProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-24 mt-2" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">Team Narrative</h2>
      </div>
      <div className="p-4 space-y-4">
        {data ? (
          <>
            {/* Stub warning */}
            {data.stub && (
              <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-800 font-medium">
                Stub mode — set ANTHROPIC_API_KEY for real narratives
              </div>
            )}

            {/* Headline */}
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{data.headline}</h3>

            {/* Narrative */}
            <p className="text-sm text-gray-700 leading-relaxed">{data.narrative}</p>

            {/* Confidence meter */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Confidence</span>
                <span>{(data.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confidenceColor(data.confidence)}`}
                  style={{ width: `${data.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Collapsible evidence */}
            {data.signals.length > 0 && (
              <div>
                <button
                  onClick={() => setEvidenceOpen((o) => !o)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {evidenceOpen ? '▾' : '▸'} Evidence ({data.signals.length} signals)
                </button>
                {evidenceOpen && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.signals.map((s, i) => (
                      <div
                        key={i}
                        title={s.interpretation}
                        className="bg-blue-50 border border-blue-100 rounded px-2 py-1 text-xs text-blue-800 max-w-xs"
                      >
                        <span className="font-medium">{s.observation}</span>
                        {' — '}
                        <span className="text-blue-600">{s.dataPoint}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Caveat */}
            {data.caveat && (
              <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
                {data.caveat}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">No narrative available.</p>
        )}
      </div>
    </div>
  )
}
