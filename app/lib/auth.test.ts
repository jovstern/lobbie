import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getAuth } from '@/app/lib/auth'
import { db } from '@/app/lib/db'
import { sendMagicLinkEmail } from '@/app/lib/mail'
import { session, user, verification } from '@/app/lib/schema'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/mail', () => ({ sendMagicLinkEmail: vi.fn() }))
afterAll(() => testDb.close())

const baseURL = 'http://localhost:3100'

beforeAll(() => {
  vi.stubEnv('BETTER_AUTH_URL', baseURL)
  vi.stubEnv('BETTER_AUTH_SECRET', 'unit-test-only-not-a-secret-7c1e4b9a2d6f8e3a')
})

async function requestLink(email: string) {
  await getAuth().api.signInMagicLink({
    body: { email, callbackURL: '/en/money', metadata: { locale: 'en' } },
    headers: new Headers(),
  })
  const { url } = vi.mocked(sendMagicLinkEmail).mock.calls.at(-1)?.[0] ?? { url: '' }
  return new URL(url)
}

describe('auth', () => {
  it('emails the link in the requested language and stores only a hash of its token', async () => {
    const link = await requestLink('dana@example.com')

    expect(sendMagicLinkEmail).toHaveBeenLastCalledWith({
      to: 'dana@example.com',
      url: link.toString(),
      locale: 'en',
    })
    const token = link.searchParams.get('token') ?? ''
    expect(token).not.toBe('')
    const stored = await db.select({ identifier: verification.identifier }).from(verification)
    expect(stored).toHaveLength(1)
    expect(stored[0].identifier).toMatch(/^magic-link:/)
    expect(stored[0].identifier).not.toContain(token)
  })

  it('verifies the link once: a session for a new user and a redirect to the callback', async () => {
    const link = await requestLink('noa@example.com')

    const response = await getAuth().handler(new Request(link))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(`${baseURL}/en/money`)
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token=')
    const [created] = await db.select().from(user).where(eq(user.email, 'noa@example.com'))
    const sessions = await db.select().from(session).where(eq(session.userId, created.id))
    expect(sessions).toHaveLength(1)

    const again = await getAuth().handler(new Request(link))
    expect(again.headers.get('location')).toContain('error=INVALID_TOKEN')
  })

  it('has no public HTTP endpoint for requesting a link, which would skip the rate limits', async () => {
    vi.mocked(sendMagicLinkEmail).mockClear()

    const response = await getAuth().handler(
      new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseURL },
        body: JSON.stringify({ email: 'eve@example.com' }),
      }),
    )

    expect(response.status).toBe(404)
    expect(sendMagicLinkEmail).not.toHaveBeenCalled()
  })

  it('ignores phone and locale sent to /update-user: only the app writes them', async () => {
    const link = await requestLink('omer@example.com')
    const verified = await getAuth().handler(new Request(link))
    const cookie = verified.headers
      .getSetCookie()
      .map((setCookie) => setCookie.split(';')[0])
      .join('; ')

    const response = await getAuth().handler(
      new Request(`${baseURL}/api/auth/update-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseURL, cookie },
        body: JSON.stringify({ name: 'Omer', phone: '+972500000000', locale: 'en' }),
      }),
    )

    const [stored] = await db.select().from(user).where(eq(user.email, 'omer@example.com'))
    expect(response.ok, 'the request is rejected outright').toBe(false)
    expect(stored).toMatchObject({ name: '', phone: null, locale: 'he' })
  })
})

describe('signing in with a saved language', () => {
  async function verifyAs(email: string, locale: string, callbackURL: string) {
    await getAuth().api.signInMagicLink({
      body: { email, callbackURL, metadata: { locale: 'he' } },
      headers: new Headers(),
    })
    const { url } = vi.mocked(sendMagicLinkEmail).mock.calls.at(-1)?.[0] ?? { url: '' }
    // The account exists before its link is followed, with the language it saved.
    await db
      .insert(user)
      .values({ name: '', email, locale })
      .onConflictDoUpdate({ target: user.email, set: { locale } })
    return getAuth().handler(new Request(url))
  }

  it('lands in English with the cookie set, when English is saved', async () => {
    const response = await verifyAs('lea@example.com', 'en', '/money')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(`${baseURL}/en/money`)
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('better-auth.session_token='))).toBe(true)
    const locale = cookies.find((cookie) => cookie.startsWith('NEXT_LOCALE='))
    expect(locale).toMatch(/^NEXT_LOCALE=en;/)
    expect(locale).toContain('Path=/')
    expect(locale).toContain('Max-Age=31536000')
  })

  it('stays in Hebrew when Hebrew is saved', async () => {
    const response = await verifyAs('gil@example.com', 'he', '/')

    expect(response.headers.get('location')).toBe(`${baseURL}/`)
    expect(
      response.headers.getSetCookie().find((cookie) => cookie.startsWith('NEXT_LOCALE=')),
    ).toMatch(/^NEXT_LOCALE=he;/)
  })

  it('leaves a failed link alone', async () => {
    const response = await getAuth().handler(
      new Request(`${baseURL}/api/auth/magic-link/verify?token=nope&callbackURL=%2F`),
    )

    expect(response.headers.get('location')).toContain('error=INVALID_TOKEN')
    expect(response.headers.getSetCookie().join()).not.toContain('NEXT_LOCALE=')
  })
})
