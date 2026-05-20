import { z } from 'zod'

export const repoSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/, 'Invalid GitHub owner name'),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid GitHub repo name'),
})

export const insightQuerySchema = repoSchema.extend({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

export type InsightQuery = z.infer<typeof insightQuerySchema>
