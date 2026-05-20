import type { NarrativeResponse } from '../src/llm/client.js'

export interface FixtureData {
  owner: string
  repo: string
  from: string
  to: string
  contributors: { totalPrs: number; [key: string]: unknown }
  reviewHealth: { totalMergedPrs: number; [key: string]: unknown }
  prTiming: { [key: string]: unknown }
}

export interface ScoreResult {
  passed: string[]
  failed: string[]
}

export function score(response: NarrativeResponse, fixture: FixtureData): ScoreResult {
  const passed: string[] = []
  const failed: string[] = []

  function check(name: string, result: boolean): void {
    if (result) {
      passed.push(name)
    } else {
      failed.push(name)
    }
  }

  // 1. dataPointsReferenced: At least 2 signals[].dataPoint values are non-empty strings (length > 1).
  // Stub mode has no signals, so auto-pass — this criterion only applies to real LLM output.
  if (response.stub === true) {
    check('dataPointsReferenced', true)
  } else {
    const meaningfulDataPoints = response.signals.filter(
      s => typeof s.dataPoint === 'string' && s.dataPoint.length > 1,
    )
    check('dataPointsReferenced', meaningfulDataPoints.length >= 2)
  }

  // 2. confidenceCalibrated: If totalMergedPrs < 20, confidence must be < 0.5.
  // Stubs have confidence = 0 so they always pass.
  if (fixture.reviewHealth.totalMergedPrs < 20) {
    check('confidenceCalibrated', response.confidence < 0.5)
  } else {
    check('confidenceCalibrated', true)
  }

  // 3. caveatPresent: If totalMergedPrs < 20, caveat must not be null.
  if (fixture.reviewHealth.totalMergedPrs < 20) {
    check('caveatPresent', response.caveat !== null)
  } else {
    check('caveatPresent', true)
  }

  // 4. noHallucination: All numbers in narrative must appear in the fixture JSON.
  // Stub mode automatically passes.
  if (response.stub === true) {
    check('noHallucination', true)
  } else {
    const fixtureText = JSON.stringify(fixture)
    const numbersInNarrative = response.narrative.match(/\d+\.?\d*/g) ?? []
    const allFound = numbersInNarrative.every(n => fixtureText.includes(n))
    check('noHallucination', allFound)
  }

  // 5. hypothesisSpecific: hypothesis is null, or does not contain forbidden phrases.
  // Stub (hypothesis null) always passes.
  if (response.hypothesis === null) {
    check('hypothesisSpecific', true)
  } else {
    const forbiddenPhrases = ['the team should', 'you should', 'consider', 'improve']
    const lower = response.hypothesis.toLowerCase()
    const hasForbidden = forbiddenPhrases.some(phrase => lower.includes(phrase))
    check('hypothesisSpecific', !hasForbidden)
  }

  return { passed, failed }
}
