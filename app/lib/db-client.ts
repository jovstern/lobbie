import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * The database type every data function takes. Both the postgres-js database (the app,
 * scripts) and the PGlite database (tests) satisfy it.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Opens a postgres-js client. `prepare: false` because the Neon connection strings are the
 * pooled ones (PgBouncer in transaction mode), where named prepared statements are not
 * guaranteed to reach the same backend.
 */
export function createDbClient(url: string) {
  // Notices ("schema already exists, skipping") are not errors and would bypass the logger.
  const client = postgres(url, { prepare: false, onnotice: () => {} })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}
