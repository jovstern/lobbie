import type { BetterAuthOptions } from 'better-auth'
import { magicLink } from 'better-auth/plugins'

/**
 * Better Auth options that shape the schema, without the database. `auth.ts` adds the
 * Drizzle adapter; `scripts/auth-schema.config.ts` uses these alone so `npm run
 * auth:generate` can load them (the CLI cannot import a module graph with 'server-only').
 */
export const authOptions = {
  advanced: {
    // Every app table references `user.id` as a uuid (spec §5).
    database: { generateId: 'uuid' },
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: false },
      locale: { type: 'string', required: false, defaultValue: 'he' },
    },
  },
  plugins: [
    magicLink({
      // Task 5 adds app/lib/mail.ts; until then sign-in must fail loudly, not silently.
      sendMagicLink: async () => {
        throw new Error('mail not configured')
      },
    }),
  ],
} satisfies BetterAuthOptions
