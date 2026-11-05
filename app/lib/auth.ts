import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins'
import { z } from 'zod'
import { authOptions } from './auth-options'
import { db } from './db'
import { requireEnv } from './env'
import { sendMagicLinkEmail } from './mail'
import { routing } from '@/i18n/routing'

// The locale the sign-in action passes as `metadata`, so the email speaks the page's language.
const linkMetadata = z.object({ locale: z.enum(routing.locales) })

function createAuth() {
  const baseURL = requireEnv('BETTER_AUTH_URL')
  return betterAuth({
    ...authOptions,
    baseURL,
    secret: requireEnv('BETTER_AUTH_SECRET'),
    trustedOrigins: [new URL(baseURL).origin],
    database: drizzleAdapter(db, { provider: 'pg' }),
    // Links are requested only through the sign-in Server Action, which applies our rate
    // limits; the public HTTP endpoint would bypass them. Verifying a link stays enabled.
    disabledPaths: ['/sign-in/magic-link'],
    // Most requests read the session from a signed cookie instead of the database.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        // Only a hash reaches the database, so a leaked table cannot sign anyone in.
        storeToken: 'hashed',
        // New people sign up through a link too; they join a building by invite (M2).
        disableSignUp: false,
        sendMagicLink: async ({ email, url, metadata }) => {
          const parsed = linkMetadata.safeParse(metadata)
          const locale = parsed.success ? parsed.data.locale : routing.defaultLocale
          await sendMagicLinkEmail({ to: email, url, locale })
        },
      }),
      // Lets Server Actions set and clear the session cookie; it must be the last plugin.
      nextCookies(),
    ],
  })
}

type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined

/**
 * Better Auth, created on first use. Creating it checks BETTER_AUTH_SECRET and
 * BETTER_AUTH_URL, so `next build` and unit tests run without them and a missing one is
 * reported by name when auth is first needed.
 */
export function getAuth(): Auth {
  instance ??= createAuth()
  return instance
}
