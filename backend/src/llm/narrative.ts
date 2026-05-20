import type { Kysely } from 'kysely'
import type { DB } from '../db/types.js'
import { computeContributors } from '../insights/contributors.js'
import { computeReviewHealth } from '../insights/reviewHealth.js'
import { computePrTiming } from '../insights/prTiming.js'
import { generateNarrative, type NarrativeResponse } from './client.js'

export type { NarrativeResponse }

export async function buildNarrative(
  owner: string,
  repo: string,
  from: Date,
  to: Date,
  db: Kysely<DB>,
): Promise<NarrativeResponse> {
  const [contributors, reviewHealth, prTiming] = await Promise.all([
    computeContributors(db, owner, repo, from, to),
    computeReviewHealth(db, owner, repo, from, to),
    computePrTiming(db, owner, repo, from, to),
  ])

  return generateNarrative({
    owner,
    repo,
    from: from.toISOString(),
    to: to.toISOString(),
    contributors,
    reviewHealth,
    prTiming,
  })
}
