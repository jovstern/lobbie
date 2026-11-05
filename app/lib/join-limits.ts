import 'server-only'
import { headers } from 'next/headers'
import { consume, peek, type RateLimitRule } from '@/app/lib/rate-limit'
import { clientIp } from '@/app/lib/utils/client-ip'

// Limits against guessing invite codes. Only misses (a well-formed code that names no invite)
// count against an address, so a building's meeting on one Wi-Fi can all join at once; each
// person's own tries count, hits included. A malformed code is never looked up, so it reveals
// nothing and is not counted.
const fifteenMinutes = 15 * 60 * 1000
export const joinRules = {
  perUser: { limit: 10, windowMs: fifteenMinutes },
  missesPerIp: { limit: 100, windowMs: fifteenMinutes },
  previewMissesPerIp: { limit: 60, windowMs: fifteenMinutes },
} satisfies Record<string, RateLimitRule>

async function ipKey(prefix: string): Promise<string> {
  return `${prefix}:ip:${clientIp(await headers())}`
}

const secondsToWait = (...limits: Awaited<ReturnType<typeof peek>>[]) =>
  Math.max(0, ...limits.map((limit) => (limit.ok ? 0 : limit.retryAfterSeconds)))

/** Counts a code entry or redemption by `userId`; seconds to wait, or 0. */
export async function joinAttempt(userId: string): Promise<number> {
  const limits = await Promise.all([
    consume(`join:user:${userId}`, joinRules.perUser),
    peek(await ipKey('join'), joinRules.missesPerIp),
  ])
  return secondsToWait(...limits)
}

/** Counts a code entry or redemption that named no invite against the address. */
export async function joinMiss(): Promise<void> {
  await consume(await ipKey('join'), joinRules.missesPerIp)
}

/** Whether the address may look at another invite page; seconds to wait, or 0. */
export async function previewWait(): Promise<number> {
  return secondsToWait(await peek(await ipKey('join-preview'), joinRules.previewMissesPerIp))
}

/** Counts an invite page whose code named no invite against the address. */
export async function previewMiss(): Promise<void> {
  await consume(await ipKey('join-preview'), joinRules.previewMissesPerIp)
}
