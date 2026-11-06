import 'server-only'
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/app/lib/db'
import { logger } from '@/app/lib/logger'
import { rateLimits } from '@/app/lib/schema'

export type RateLimitRule = { limit: number; windowMs: number }
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

type Options = {
  now?: Date
  /** Returns a number in [0, 1); tests pass a fixed one to force or skip pruning. */
  random?: () => number
}

const pruneAfterMs = 24 * 60 * 60 * 1000
// Pruning on about one request in 50 keeps the table small without a delete on every write.
const pruneChance = 1 / 50

async function pruneOldWindows(now: Date) {
  try {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, new Date(now.getTime() - pruneAfterMs)))
  } catch (err) {
    // Housekeeping only: a failed prune must not fail the request it rides on.
    logger.warn('rate limit pruning failed', { err })
  }
}

function windowStartOf(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

function refused(windowStart: Date, windowMs: number, now: Date): RateLimitResult {
  const windowEnd = windowStart.getTime() + windowMs
  return { ok: false, retryAfterSeconds: Math.ceil((windowEnd - now.getTime()) / 1000) }
}

/**
 * Counts one request for `key` in a fixed window and says whether it is within `limit`.
 * The upsert is atomic, so concurrent requests cannot both take the last slot.
 */
export async function consume(
  key: string,
  { limit, windowMs }: RateLimitRule,
  { now = new Date(), random = Math.random }: Options = {},
): Promise<RateLimitResult> {
  const windowStart = windowStartOf(now, windowMs)
  const [{ count }] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count })

  if (random() < pruneChance) await pruneOldWindows(now)

  if (count <= limit) return { ok: true }
  return refused(windowStart, windowMs, now)
}

/**
 * Whether `key` has used up `limit` in the current window, without counting this request: for
 * limits that count only failures (`consume` is called after one). Checking and counting are
 * two statements, so concurrent failures can overshoot the limit by a few; that is acceptable
 * for a limit against guessing.
 */
export async function peek(
  key: string,
  { limit, windowMs }: RateLimitRule,
  { now = new Date() }: Pick<Options, 'now'> = {},
): Promise<RateLimitResult> {
  const windowStart = windowStartOf(now, windowMs)
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)))
  if (!row || row.count < limit) return { ok: true }
  return refused(windowStart, windowMs, now)
}
