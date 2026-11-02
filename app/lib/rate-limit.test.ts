import { count } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { logger } from '@/app/lib/logger'
import { consume } from '@/app/lib/rate-limit'
import { rateLimits } from '@/app/lib/schema'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/logger', () => ({ logger: { warn: vi.fn() } }))
afterAll(() => testDb.close())

beforeEach(async () => {
  await db.delete(rateLimits)
})

const fifteenMinutes = 15 * 60 * 1000
const rule = { limit: 3, windowMs: fifteenMinutes }
// 10:05 UTC: the 15-minute window runs from 10:00 to 10:15.
const now = new Date('2026-11-02T10:05:00Z')
const never = () => 1
const always = () => 0

describe('consume', () => {
  it('allows requests up to the limit', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await consume('magic:email:a@example.com', rule, { now, random: never })).toEqual({
        ok: true,
      })
    }
  })

  it('refuses the request after the limit, until the window ends', async () => {
    for (let i = 0; i < 3; i++)
      await consume('magic:email:a@example.com', rule, { now, random: never })

    expect(await consume('magic:email:a@example.com', rule, { now, random: never })).toEqual({
      ok: false,
      retryAfterSeconds: 10 * 60,
    })
  })

  it('rounds the wait up to a whole second', async () => {
    for (let i = 0; i < 3; i++) await consume('k', rule, { now, random: never })

    const result = await consume('k', rule, {
      now: new Date('2026-11-02T10:14:59.500Z'),
      random: never,
    })
    expect(result).toEqual({ ok: false, retryAfterSeconds: 1 })
  })

  it('starts counting again in a new window', async () => {
    for (let i = 0; i < 4; i++) await consume('k', rule, { now, random: never })

    expect(
      await consume('k', rule, { now: new Date('2026-11-02T10:15:00Z'), random: never }),
    ).toEqual({ ok: true })
  })

  it('counts each key on its own', async () => {
    for (let i = 0; i < 3; i++)
      await consume('magic:email:a@example.com', rule, { now, random: never })

    expect(await consume('magic:email:b@example.com', rule, { now, random: never })).toEqual({
      ok: true,
    })
    expect(await consume('magic:ip:203.0.113.7', rule, { now, random: never })).toEqual({
      ok: true,
    })
  })

  it('counts concurrent requests atomically', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => consume('k', rule, { now, random: never })),
    )

    expect(results.filter((result) => result.ok)).toHaveLength(3)
  })

  it('prunes windows older than a day when the sampled chance hits', async () => {
    await consume('old', rule, { now: new Date('2026-10-31T10:00:00Z'), random: never })
    await consume('recent', rule, { now: new Date('2026-11-02T09:00:00Z'), random: never })

    await consume('k', rule, { now, random: always })

    const keys = await db.select({ key: rateLimits.key }).from(rateLimits)
    expect(keys.map((row) => row.key).sort()).toEqual(['k', 'recent'])
  })

  it('leaves old windows alone when the chance misses', async () => {
    await consume('old', rule, { now: new Date('2026-10-31T10:00:00Z'), random: never })

    await consume('k', rule, { now, random: never })

    const [{ rows }] = await db.select({ rows: count() }).from(rateLimits)
    expect(rows).toBe(2)
  })

  it('still answers, with a warning, when pruning fails', async () => {
    const deleteSpy = vi.spyOn(db, 'delete').mockImplementationOnce(() => {
      throw new Error('lock timeout')
    })

    expect(await consume('k', rule, { now, random: always })).toEqual({ ok: true })
    expect(logger.warn).toHaveBeenCalledWith('rate limit pruning failed', {
      err: expect.any(Error),
    })
    deleteSpy.mockRestore()
  })
})
