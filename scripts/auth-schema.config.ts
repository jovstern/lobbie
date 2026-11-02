import { betterAuth } from 'better-auth'
import { authOptions } from '../app/lib/auth-options'

// Read only by `npm run auth:generate` (with `--adapter drizzle --dialect postgresql`), which
// needs the options that shape the tables but no database connection.
export const auth = betterAuth(authOptions)
