import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { authOptions } from './auth-options'
import { db } from './db'

export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { provider: 'pg' }),
})
