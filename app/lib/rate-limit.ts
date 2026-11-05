import 'server-only'
import { lt, sql } from 'drizzle-orm'
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

/**
 * Counts one request for `key` in a fixed window and says whether it is within `limit`.
 * The upsert is atomic, so concurrent requests cannot both take the last slot.
 */
export async function consume(
  key: string,
  { limit, windowMs }: RateLimitRule,
  { now = new Date(), random = Math.random }: Options = {},
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs)
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
  const windowEnd = windowStart.getTime() + windowMs
  return { ok: false, retryAfterSeconds: Math.ceil((windowEnd - now.getTime()) / 1000) }
}
