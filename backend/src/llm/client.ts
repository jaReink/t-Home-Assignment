import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { config } from '../config.js'
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

const NarrativeSignalSchema = z.object({
  observation: z.string(),
  dataPoint: z.string(),
  interpretation: z.string(),
})

const NarrativeResponseSchema = z.object({
  headline: z.string(),
  narrative: z.string(),
  hypothesis: z.string().nullable(),
  confidence: z.number(),
  signals: z.array(NarrativeSignalSchema),
  caveat: z.string().nullable(),
})

const client = config.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  : null

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
{ "headline": string, "narrative": string, "hypothesis": string | null, "confidence": number, "signals": [{"observation": string, "dataPoint": string, "interpretation": string}], "caveat": string | null }`
}

export async function generateNarrative(data: NarrativeInput): Promise<NarrativeResponse> {
  if (!client) {
    return buildStub()
  }

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

  const textBlock = message.content.find(block => block.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : ''

  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    const validated = NarrativeResponseSchema.parse(parsed)
    return { ...validated, generatedAt: new Date().toISOString(), stub: false }
  } catch (err) {
    console.error('Failed to parse or validate LLM response:', err)
    throw new Error('LLM returned an unexpected response format')
  }
}
