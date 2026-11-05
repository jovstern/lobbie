import 'server-only'
import { createDbClient, type Db } from './db-client'
import { requireEnv } from './env'

export type { Db }

// `next dev` re-evaluates modules on every edit; keeping the client on globalThis stops each
// reload from opening a new pool against Neon's connection limit.
const globalForDb = globalThis as typeof globalThis & { lobbieDb?: Db }

export const db: Db = globalForDb.lobbieDb ?? createDbClient(requireEnv('DATABASE_URL')).db

if (process.env.NODE_ENV !== 'production') globalForDb.lobbieDb = db
