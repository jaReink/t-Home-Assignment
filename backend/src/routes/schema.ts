import { z } from 'zod'

export const repoSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/, 'Invalid GitHub owner name'),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid GitHub repo name'),
})

const MAX_RANGE_MS = 365 * 24 * 60 * 60 * 1000

export const insightQuerySchema = repoSchema
  .extend({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.from < v.to, {
    message: '"from" must be before "to"',
    path: ['from'],
  })
  .refine((v) => v.to.getTime() - v.from.getTime() <= MAX_RANGE_MS, {
    message: 'Date range cannot exceed 365 days',
    path: ['to'],
  })

export type InsightQuery = z.infer<typeof insightQuerySchema>
