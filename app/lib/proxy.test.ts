import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/app/lib/logger'
import proxy from '@/proxy'

// The proxy's session-cache renewal, end to end through proxy(): Better Auth is stubbed, so
// these pin what the proxy does with the cookies it gets back.
const getSession = vi.hoisted(() => vi.fn())
vi.mock('@/app/lib/auth', () => ({ getAuth: () => ({ api: { getSession } }) }))
vi.mock('@/app/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))
// next-intl's middleware cannot load in Vitest (it imports `next/server` without an
// extension). This stand-in does the two things the proxy relies on: forward the request's
// headers, or redirect `/he…` to its unprefixed path. Its real routing is covered by e2e.
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server')
  return {
    default: () => (forwarded: Request) => {
      const url = new URL(forwarded.url)
      if (url.pathname === '/he' || url.pathname.startsWith('/he/')) {
        url.pathname = url.pathname.slice(3) || '/'
        return NextResponse.redirect(url)
      }
      return NextResponse.next({ request: { headers: forwarded.headers } })
    },
  }
})

const base = 'http://localhost:3000'
const session = 'better-auth.session_token=tok.sig'
const renewedData = 'better-auth.session_data=fresh-cache'

function answer(setCookies: string[]) {
  const headers = new Headers()
  for (const cookie of setCookies) headers.append('set-cookie', cookie)
  getSession.mockResolvedValue({ headers, response: null })
}

function request(path: string, cookie: string, init: { method?: string } = {}) {
  return new NextRequest(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: { cookie, 'sec-fetch-dest': 'document' },
  })
}

const setCookieNames = (response: Response) =>
  response.headers.getSetCookie().map((cookie) => cookie.slice(0, cookie.indexOf('=')))

const renewedOn = (response: Response) =>
  response.headers.getSetCookie().filter((cookie) => cookie.startsWith('better-auth.session_data='))

beforeEach(() => {
  vi.clearAllMocks()
  answer([`${renewedData}; Max-Age=300; Path=/; HttpOnly; SameSite=Lax`])
})

describe('proxy, session cache renewal', () => {
  it('renews once on a pass-through, and the page sees the new cache cookie', async () => {
    const response = await proxy(request('/more', session))

    expect(getSession).toHaveBeenCalledOnce()
    expect(response.headers.has('location')).toBe(false)
    expect(renewedOn(response)).toHaveLength(1)
    const names = setCookieNames(response)
    expect(names).toEqual([...new Set(names)])
    // The forwarded request's cookies, as Next hands them to the page.
    expect(response.headers.get('x-middleware-request-cookie')).toContain(renewedData)
  })

  it('keeps one Set-Cookie per name when Better Auth repeats one', async () => {
    answer([`${renewedData.replace('fresh', 'old')}; Path=/`, `${renewedData}; Path=/`])

    const response = await proxy(request('/more', session))

    expect(renewedOn(response)).toEqual([`${renewedData}; Path=/`])
  })

  it('carries the cookies on next-intl’s redirect (/he → /)', async () => {
    const response = await proxy(request('/he', session))

    expect(response.headers.get('location')).toBe(`${base}/`)
    expect(renewedOn(response)).toHaveLength(1)
  })

  it('carries the cookies on the saved-locale redirect', async () => {
    const response = await proxy(request('/more', `${session}; NEXT_LOCALE=en`))

    expect(response.headers.get('location')).toBe(`${base}/en/more`)
    expect(renewedOn(response)).toHaveLength(1)
  })

  it('sends an ended session to sign-in, with Better Auth’s expired cookies', async () => {
    answer([
      'better-auth.session_token=; Max-Age=0; Path=/',
      'better-auth.session_data=; Max-Age=0; Path=/',
    ])

    const response = await proxy(request('/more', session))

    expect(response.headers.get('location')).toBe(`${base}/sign-in?next=%2Fmore`)
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        'better-auth.session_token=; Max-Age=0; Path=/',
        'better-auth.session_data=; Max-Age=0; Path=/',
      ]),
    )
  })

  it('does nothing while the cache cookie is fresh', async () => {
    const fresh = Buffer.from(JSON.stringify({ expiresAt: Date.now() + 60_000 })).toString(
      'base64url',
    )

    const response = await proxy(request('/more', `${session}; better-auth.session_data=${fresh}`))

    expect(getSession).not.toHaveBeenCalled()
    expect(renewedOn(response)).toEqual([])
  })

  it('leaves Server Actions alone, so sign-out’s deletion is the only word', async () => {
    const response = await proxy(request('/more', session, { method: 'POST' }))

    expect(getSession).not.toHaveBeenCalled()
    expect(renewedOn(response)).toEqual([])
  })

  it('on failure passes the request through, adds no session cookie and warns', async () => {
    getSession.mockRejectedValue(new Error('connection refused'))

    const response = await proxy(request('/more', session))

    expect(response.headers.has('location')).toBe(false)
    expect(setCookieNames(response).filter((name) => name.startsWith('better-auth'))).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      'session cache renewal failed',
      expect.objectContaining({ area: 'proxy' }),
    )
  })
})

describe('proxy, join pages', () => {
  it.each([
    '/join',
    '/join/ABCDE23456',
    '/en/join/ABCDE23456',
    '/sign-in?next=%2Fjoin%2FABCDE23456',
  ])('sends no referrer from %s, whose URL may hold an invite code', async (path) => {
    const response = await proxy(request(path, ''))
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('leaves other pages to the default policy', async () => {
    const response = await proxy(request('/sign-in', ''))
    expect(response.headers.get('referrer-policy')).toBeNull()
  })
})
