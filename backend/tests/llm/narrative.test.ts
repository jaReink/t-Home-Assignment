import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateNarrative, type NarrativeInput } from '../../src/llm/client.js'
import { buildNarrative } from '../../src/llm/narrative.js'
import { getDb } from '../../src/db/client.js'

const FIXTURE_INPUT: NarrativeInput = {
  owner: 'testowner',
  repo: 'testrepo',
  from: '2024-01-01T00:00:00.000Z',
  to: '2024-04-01T00:00:00.000Z',
  contributors: {
    period: { from: '2024-01-01T00:00:00.000Z', to: '2024-04-01T00:00:00.000Z' },
    repo: 'testowner/testrepo',
    totalPrs: 8,
    contributors: [{ login: 'author1', commits: 5, pullsMerged: 4, linesAdded: 200, linesDeleted: 50 }],
  },
  reviewHealth: {
    period: { from: '2024-01-01T00:00:00.000Z', to: '2024-04-01T00:00:00.000Z' },
    repo: 'testowner/testrepo',
    totalMergedPrs: 8,
    overallSilentApprovalRate: 0.25,
    overallUnreviewedMergeRate: 0.125,
    reviewers: [],
    authors: [],
  },
  prTiming: {
    period: { from: '2024-01-01T00:00:00.000Z', to: '2024-04-01T00:00:00.000Z' },
    repo: 'testowner/testrepo',
    totalPrsWithReview: 6,
    medianPickupHours: 4,
    p75PickupHours: 8,
    p95PickupHours: 24,
    buckets: [],
    hourOfDayHeatmap: [],
  },
}

describe('generateNarrative — stub mode', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  })

  it('returns stub response when ANTHROPIC_API_KEY is not set', async () => {
    const result = await generateNarrative(FIXTURE_INPUT)

    expect(result.stub).toBe(true)
    expect(typeof result.headline).toBe('string')
    expect(typeof result.narrative).toBe('string')
    expect(result.hypothesis === null || typeof result.hypothesis === 'string').toBe(true)
    expect(typeof result.confidence).toBe('number')
    expect(Array.isArray(result.signals)).toBe(true)
    expect(result.caveat === null || typeof result.caveat === 'string').toBe(true)
    expect(typeof result.generatedAt).toBe('string')
  })
})

describe('generateNarrative — parse failure fallback', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-fake-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns stub when the LLM returns non-JSON text', async () => {
    vi.mock('@anthropic-ai/sdk', () => {
      return {
        default: class MockAnthropic {
          messages = {
            create: vi.fn().mockResolvedValue({
              content: [{ type: 'text', text: 'not json' }],
            }),
          }
        },
      }
    })

    // Re-import after mocking to get the mocked version
    const { generateNarrative: gen } = await import('../../src/llm/client.js')
    const result = await gen(FIXTURE_INPUT)

    expect(result.stub).toBe(true)
    expect(typeof result.headline).toBe('string')
    expect(typeof result.narrative).toBe('string')
    expect(Array.isArray(result.signals)).toBe(true)
    expect(typeof result.confidence).toBe('number')
    expect(typeof result.generatedAt).toBe('string')
  })
})

describe('buildNarrative — stub pass-through', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(async () => {
    if (originalKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
    const db = getDb()
    await db.deleteFrom('reviews').execute()
    await db.deleteFrom('pulls').execute()
    await db.deleteFrom('commits').execute()
  })

  it('returns stub from buildNarrative when no API key is configured', async () => {
    const db = getDb()
    const from = new Date('2024-01-01T00:00:00Z')
    const to = new Date('2024-04-01T00:00:00Z')

    const result = await buildNarrative('testowner', 'testrepo', from, to, db)

    expect(result.stub).toBe(true)
    expect(typeof result.confidence).toBe('number')
    expect(result.confidence).toBe(0)
    expect(Array.isArray(result.signals)).toBe(true)
  })
})
