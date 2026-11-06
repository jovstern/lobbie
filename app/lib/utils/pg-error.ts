import { z } from 'zod'

/** Postgres error codes the actions turn into messages. */
export const pgErrorCode = { uniqueViolation: '23505', foreignKeyViolation: '23503' } as const

// postgres-js names the constraint `constraint_name`; PGlite (the tests) names it `constraint`.
const driverError = z.object({
  code: z.string(),
  constraint: z.string().optional(),
  constraint_name: z.string().optional(),
})

export type PgError = { code: string; constraint: string | null }

/**
 * The Postgres error behind a failed query, or null. Drizzle wraps the driver's error in its
 * own, so the chain of causes is followed.
 */
export function pgError(err: unknown): PgError | null {
  let current = err
  // A few levels at most: Drizzle's error, then the driver's.
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const parsed = driverError.safeParse(current)
    if (parsed.success) {
      const { code, constraint, constraint_name } = parsed.data
      return { code, constraint: constraint ?? constraint_name ?? null }
    }
    current = current instanceof Error ? current.cause : undefined
  }
  return null
}
