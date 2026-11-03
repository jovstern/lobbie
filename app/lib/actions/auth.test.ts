import { createTranslator } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestMagicLink, signOut, type SignInState } from '@/app/lib/actions/auth'
import { logger } from '@/app/lib/logger'
import { consume } from '@/app/lib/rate-limit'
import type { Locale } from '@/i18n/routing'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

class Redirected extends Error {
  constructor(readonly target: unknown) {
    super('NEXT_REDIRECT')
  }
}

const api = vi.hoisted(() => ({ signInMagicLink: vi.fn(), signOut: vi.fn() }))
const requestHeaders = vi.hoisted(() => new Headers())
vi.mock('@/app/lib/auth', () => ({ getAuth: () => ({ api }) }))
vi.mock('@/app/lib/rate-limit', () => ({ consume: vi.fn() }))
vi.mock('@/app/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }))
vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn((target: unknown) => {
    throw new Redirected(target)
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: Locale; namespace: 'SignInErrors' }) =>
    createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

const initial: SignInState = {}

function form(email: string) {
  const data = new FormData()
  data.set('email', email)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consume).mockResolvedValue({ ok: true })
  api.signInMagicLink.mockResolvedValue({ status: true })
  for (const name of [...requestHeaders.keys()]) requestHeaders.delete(name)
  requestHeaders.set('x-forwarded-for', '203.0.113.7, 10.0.0.1')
})

describe('requestMagicLink', () => {
  it.each(['', 'not-an-email', 'a@', '   '])(
    'returns a field error for %j and keeps what was typed',
    async (email) => {
      const state = await requestMagicLink({ locale: 'en' }, initial, form(email))

      expect(state).toEqual({
        email,
        errors: { email: [en.SignInErrors.invalidEmail] },
        message: null,
      })
      expect(consume).not.toHaveBeenCalled()
      expect(api.signInMagicLink).not.toHaveBeenCalled()
    },
  )

  it('answers in Hebrew on the Hebrew page', async () => {
    const state = await requestMagicLink({ locale: 'he' }, initial, form('x'))

    expect(state.errors?.email).toEqual([he.SignInErrors.invalidEmail])
  })

  it('limits by the trimmed, lowercased email and by the first forwarded IP', async () => {
    await expect(
      requestMagicLink({ locale: 'en' }, initial, form('  Dana@Example.COM ')),
    ).rejects.toBeInstanceOf(Redirected)

    const fifteenMinutes = 15 * 60 * 1000
    expect(consume).toHaveBeenCalledWith('magic:email:dana@example.com', {
      limit: 3,
      windowMs: fifteenMinutes,
    })
    expect(consume).toHaveBeenCalledWith('magic:ip:203.0.113.7', {
      limit: 10,
      windowMs: fifteenMinutes,
    })
  })

  it('limits by an "unknown" IP when no address is forwarded', async () => {
    requestHeaders.delete('x-forwarded-for')

    await expect(
      requestMagicLink({ locale: 'en' }, initial, form('dana@example.com')),
    ).rejects.toBeInstanceOf(Redirected)

    expect(consume).toHaveBeenCalledWith('magic:ip:unknown', expect.anything())
  })

  it('returns the longest wait once rate-limited, and sends nothing', async () => {
    vi.mocked(consume)
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 61 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 400 })

    const state = await requestMagicLink({ locale: 'en' }, initial, form('dana@example.com'))

    expect(state).toEqual({
      email: 'dana@example.com',
      message: null,
      retryAfterSeconds: 400,
    })
    expect(api.signInMagicLink).not.toHaveBeenCalled()
  })

  it('sends the link with a callback to the page asked for, then shows check-email', async () => {
    await expect(
      requestMagicLink({ locale: 'en', next: '/en/money' }, initial, form('dana@example.com')),
    ).rejects.toEqual(
      new Redirected({ href: '/sign-in/check-email?email=dana%40example.com', locale: 'en' }),
    )

    expect(api.signInMagicLink).toHaveBeenCalledWith({
      body: {
        email: 'dana@example.com',
        callbackURL: '/en/money',
        errorCallbackURL: '/en/sign-in',
        metadata: { locale: 'en' },
      },
      headers: requestHeaders,
    })
  })

  it('adds the locale prefix to a next path without one', async () => {
    await expect(
      requestMagicLink({ locale: 'en', next: '/money' }, initial, form('dana@example.com')),
    ).rejects.toBeInstanceOf(Redirected)

    expect(api.signInMagicLink.mock.calls[0][0].body.callbackURL).toBe('/en/money')
  })

  it('reaches check-email for an email no one has used before, too', async () => {
    await expect(
      requestMagicLink({ locale: 'he' }, initial, form('stranger@example.com')),
    ).rejects.toEqual(
      new Redirected({ href: '/sign-in/check-email?email=stranger%40example.com', locale: 'he' }),
    )

    expect(api.signInMagicLink.mock.calls[0][0].body).toMatchObject({
      callbackURL: '/',
      errorCallbackURL: '/sign-in',
    })
  })

  it.each([
    ['//evil.com', 'en', '/en'],
    ['https://evil.com/', 'he', '/'],
    ['/\\evil.com', 'en', '/en'],
  ] as const)('replaces the unsafe next %j with home (%s)', async (next, locale, expected) => {
    await expect(
      requestMagicLink({ locale, next }, initial, form('dana@example.com')),
    ).rejects.toBeInstanceOf(Redirected)

    expect(api.signInMagicLink.mock.calls[0][0].body.callbackURL).toBe(expected)
  })

  it('falls back to Hebrew for an unknown locale', async () => {
    await expect(
      requestMagicLink({ locale: 'fr' }, initial, form('dana@example.com')),
    ).rejects.toEqual(
      new Redirected({ href: '/sign-in/check-email?email=dana%40example.com', locale: 'he' }),
    )
  })

  it('returns a message and logs when the email cannot be sent', async () => {
    const failure = new Error('mail not configured')
    api.signInMagicLink.mockRejectedValue(failure)

    const state = await requestMagicLink({ locale: 'en' }, initial, form('dana@example.com'))

    expect(state).toEqual({ email: 'dana@example.com', message: en.SignInErrors.sendFailed })
    expect(logger.error).toHaveBeenCalledWith('magic link request failed', {
      err: failure,
      route: '/sign-in',
    })
  })

  it('returns a message and logs when the rate limiter fails', async () => {
    vi.mocked(consume).mockRejectedValue(new Error('connection refused'))

    const state = await requestMagicLink({ locale: 'en' }, initial, form('dana@example.com'))

    expect(state.message).toBe(en.SignInErrors.sendFailed)
    expect(logger.error).toHaveBeenCalled()
    expect(api.signInMagicLink).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('ends the session and goes to sign-in in the same language', async () => {
    api.signOut.mockResolvedValue({ success: true })

    await expect(signOut('en')).rejects.toEqual(
      new Redirected({ href: '/sign-in?signedOut=1', locale: 'en' }),
    )
    expect(api.signOut).toHaveBeenCalledWith({ headers: requestHeaders })
  })

  it('still goes to sign-in, logged, when there was no session to end', async () => {
    api.signOut.mockRejectedValue(new Error('FAILED_TO_GET_SESSION'))

    await expect(signOut('he')).rejects.toEqual(
      new Redirected({ href: '/sign-in?signedOut=1', locale: 'he' }),
    )
    expect(logger.warn).toHaveBeenCalled()
  })
})
