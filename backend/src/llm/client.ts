import Anthropic from '@anthropic-ai/sdk'
import type { ContributorsResult } from '../insights/contributors.js'
import type { ReviewHealthResult } from '../insights/reviewHealth.js'
import type { PrTimingResult } from '../insights/prTiming.js'

export interface NarrativeInput {
  owner: string
  repo: string
  from: string
  to: string
  contributors: ContributorsResult
  reviewHealth: ReviewHealthResult
  prTiming: PrTimingResult
}

export interface NarrativeSignal {
  observation: string
  dataPoint: string
  interpretation: string
}

export interface NarrativeResponse {
  headline: string
  narrative: string
  hypothesis: string | null
  confidence: number
  signals: NarrativeSignal[]
  caveat: string | null
  generatedAt: string
  stub: boolean
}

const STUB_RESPONSE: NarrativeResponse = {
  headline: 'Stub narrative — set ANTHROPIC_API_KEY to enable',
  narrative: 'No API key configured.',
  hypothesis: null,
  confidence: 0,
  signals: [],
  caveat: 'Stub mode active.',
  generatedAt: new Date().toISOString(),
  stub: true,
}

// STUB_RESPONSE.generatedAt is frozen at module load time — spread and override so each
// call returns the actual request time rather than the server start time.
function buildStub(): NarrativeResponse {
  return { ...STUB_RESPONSE, generatedAt: new Date().toISOString() }
}

function buildPrompt(input: NarrativeInput): string {
  return `You are analyzing GitHub collaboration data for ${input.owner}/${input.repo} from ${input.from} to ${input.to}.

Here is the raw data:
<contributors>${JSON.stringify(input.contributors)}</contributors>
<review_health>${JSON.stringify(input.reviewHealth)}</review_health>
<pr_timing>${JSON.stringify(input.prTiming)}</pr_timing>

Rules:
- Every claim in "narrative" must be supported by a specific number in the data above.
- "hypothesis" must be falsifiable and specific — or null if the data does not support one.
- "confidence" must reflect sample size: < 0.5 if totalMergedPrs < 20, cap at 0.85 for any single-repo analysis.
- "caveat" is required when totalMergedPrs < 20.
- Do not fabricate metrics not present in the input.

Respond with valid JSON matching this schema exactly:
{ "headline": string, "narrative": string, "hypothesis": string | null, "confidence": number, "signals": [{"observation": string, "dataPoint": string, "interpretation": string}], "caveat": string | null, "generatedAt": string }`
}

export async function generateNarrative(data: NarrativeInput): Promise<NarrativeResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildStub()
  }

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: buildPrompt(data),
      },
    ],
  })

  // Anthropic returns a ContentBlock[] discriminated union. We need the text block
  // specifically; the second type check is required for TypeScript to narrow to TextBlock.
  const textBlock = message.content.find(block => block.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : ''

  try {
    // Strip markdown code fences if the model wraps its response (e.g. ```json ... ```)
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    return { ...parsed, stub: false }
  } catch (err) {
    console.error('Failed to parse LLM response as JSON:', err)
    return buildStub()
  }
}
