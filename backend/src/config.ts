import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  ANTHROPIC_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  CACHE_TTL_MINUTES: z.coerce.number().default(15),
  NARRATIVE_CACHE_TTL_MINUTES: z.coerce.number().default(15),
  DB_PATH: z.string().default('./data/insights.db'),
  SYNC_LOOKBACK_MONTHS: z.coerce.number().min(1).max(24).default(6), // cap at 24 to avoid exhausting rate limits on first sync
  GITHUB_GRAPHQL_URL: z.string().url().default('https://api.github.com/graphql'),
  GITHUB_REST_URL: z.string().url().default('https://api.github.com'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const config = parsed.data
