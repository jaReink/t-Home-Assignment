import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateNarrative, type NarrativeInput } from '../src/llm/client.js'
import { score, type FixtureData } from './scorer.js'

// ESM doesn't expose __dirname — reconstruct it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url))

const FIXTURES = ['healthy-team', 'review-theater', 'sparse-data', 'solo-contributor'] as const

async function main(): Promise<void> {
  let totalPassed = 0
  let totalFailed = 0
  let anyFailed = false

  for (const fixtureName of FIXTURES) {
    const fixturePath = join(__dirname, 'fixtures', `${fixtureName}.json`)
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as NarrativeInput & FixtureData

    let response
    try {
      response = await generateNarrative(fixture)
    } catch (err) {
      console.error(`Fixture: ${fixtureName}`)
      console.error(`  ERROR: generateNarrative threw: ${err}`)
      totalFailed += 5 // count all criteria as failed
      anyFailed = true
      continue
    }

    const { passed, failed } = score(response, fixture)
    totalPassed += passed.length
    totalFailed += failed.length

    console.log(`Fixture: ${fixtureName}`)
    for (const criterion of passed) {
      console.log(`  ✓ ${criterion}`)
    }
    for (const criterion of failed) {
      console.log(`  ✗ ${criterion}`)
      anyFailed = true
    }
  }

  const total = totalPassed + totalFailed
  console.log('')
  console.log(`Summary: ${totalPassed}/${total} criteria passed`)

  if (anyFailed) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Runner failed unexpectedly:', err)
  process.exit(1)
})
