import { describe, expect, it } from 'vitest'
import { needsSessionCacheRenewal } from './session-cache'

const now = Date.parse('2026-11-03T10:00:00Z')

function cacheCookie(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

const fresh = cacheCookie({
  session: { user: { name: 'דנה' } },
  expiresAt: now + 60_000,
  signature: 's',
})
const expired = cacheCookie({ session: {}, expiresAt: now - 1, signature: 's' })

describe('needsSessionCacheRenewal', () => {
  it('is false without cookies or without a session', () => {
    expect(needsSessionCacheRenewal(null, now)).toBe(false)
    expect(needsSessionCacheRenewal('', now)).toBe(false)
    expect(needsSessionCacheRenewal(`NEXT_LOCALE=en; better-auth.session_data=${fresh}`, now)).toBe(
      false,
    )
  })

  it('is true when the session has no cache cookie', () => {
    expect(needsSessionCacheRenewal('better-auth.session_token=abc.sig', now)).toBe(true)
    expect(needsSessionCacheRenewal('__Secure-better-auth.session_token=abc.sig', now)).toBe(true)
  })

  it('is false while the cache cookie is fresh, so no database call is made', () => {
    expect(
      needsSessionCacheRenewal(
        `better-auth.session_token=abc.sig; better-auth.session_data=${fresh}`,
        now,
      ),
    ).toBe(false)
    expect(
      needsSessionCacheRenewal(
        `__Secure-better-auth.session_token=abc.sig; __Secure-better-auth.session_data=${fresh}`,
        now,
      ),
    ).toBe(false)
  })

  it('reads a cache cookie split into chunks', () => {
    const half = Math.ceil(fresh.length / 2)
    const cookie = [
      'better-auth.session_token=abc.sig',
      `better-auth.session_data.1=${fresh.slice(half)}`,
      `better-auth.session_data.0=${fresh.slice(0, half)}`,
    ].join('; ')
    expect(needsSessionCacheRenewal(cookie, now)).toBe(false)
  })

  it('is true when the cache cookie has expired', () => {
    expect(
      needsSessionCacheRenewal(
        `better-auth.session_token=abc.sig; better-auth.session_data=${expired}`,
        now,
      ),
    ).toBe(true)
  })

  it('is true when the cache cookie cannot be read', () => {
    for (const value of ['not-base64!', cacheCookie({ session: {} }), cacheCookie('x')]) {
      expect(
        needsSessionCacheRenewal(
          `better-auth.session_token=abc.sig; better-auth.session_data=${value}`,
          now,
        ),
      ).toBe(true)
    }
  })
})
