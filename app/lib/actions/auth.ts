'use server'

import { headers } from 'next/headers'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { getAuth } from '@/app/lib/auth'
import { logger } from '@/app/lib/logger'
import { consume, type RateLimitRule } from '@/app/lib/rate-limit'
import { safeNextPath, withLocalePrefix } from '@/app/lib/utils/redirect'
import { redirect } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

const fifteenMinutes = 15 * 60 * 1000
const perEmail: RateLimitRule = { limit: 3, windowMs: fifteenMinutes }
const perIp: RateLimitRule = { limit: 10, windowMs: fifteenMinutes }

const SignInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
})

export type SignInState = {
  /** What was typed, so the field keeps it after an error. */
  email?: string
  errors?: { email?: string[] }
  message?: string | null
  /** Set when rate-limited: how long until another link can be requested. */
  retryAfterSeconds?: number
}

/** Bound by the page: actions cannot read the route's locale, and `next` comes from its URL. */
export type SignInContext = { locale: string; next?: string }

function resolveLocale(locale: string): Locale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale
}

function clientIp(requestHeaders: Headers): string {
  return requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

/**
 * Emails a sign-in link. Every request that is valid and within the rate limits ends on
 * check-email, whether or not the address has an account, so the form reveals nothing.
 */
export async function requestMagicLink(
  context: SignInContext,
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const locale = resolveLocale(context.locale)
  const t = await getTranslations({ locale, namespace: 'SignInErrors' })
  const typed = formData.get('email')
  const email = typeof typed === 'string' ? typed : ''

  const validatedFields = SignInSchema.safeParse({ email: typed })
  if (!validatedFields.success) {
    return { email, errors: { email: [t('invalidEmail')] }, message: null }
  }
  const address = validatedFields.data.email
  const requestHeaders = await headers()

  try {
    const limits = await Promise.all([
      consume(`magic:email:${address}`, perEmail),
      consume(`magic:ip:${clientIp(requestHeaders)}`, perIp),
    ])
    const retryAfterSeconds = Math.max(
      0,
      ...limits.map((limit) => (limit.ok ? 0 : limit.retryAfterSeconds)),
    )
    // The form words the wait from retryAfterSeconds, in whole minutes.
    if (retryAfterSeconds > 0) return { email, message: null, retryAfterSeconds }

    await getAuth().api.signInMagicLink({
      body: {
        email: address,
        callbackURL: withLocalePrefix(safeNextPath(context.next), locale),
        // Better Auth adds `?error=…` to this for an expired or already used link.
        errorCallbackURL: withLocalePrefix('/sign-in', locale),
        metadata: { locale },
      },
      headers: requestHeaders,
    })
  } catch (err) {
    logger.error('magic link request failed', { err, route: '/sign-in' })
    return { email, message: t('sendFailed') }
  }

  return redirect({ href: '/sign-in/check-email', locale })
}

/** Ends the session and returns to sign-in in the same language. */
export async function signOut(locale: string): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() })
  } catch (err) {
    // Usually a session that had already ended; sign-in is the right place either way.
    logger.warn('sign-out failed', { err, route: '/sign-out' })
  }
  return redirect({ href: '/sign-in', locale: resolveLocale(locale) })
}
