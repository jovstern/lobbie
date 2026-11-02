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
})
