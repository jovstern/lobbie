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
 * pooled ones (PgBouncer in transaction mode). PgBouncer 1.21+ does carry protocol-level
 * prepared statements, but it keeps them on its server connections across clients, keyed by
 * the query's text: after a migration changes a selected column's type (or recreates an enum),
 * every reuse fails with "cached plan must not change result type", and postgres-js's own
 * re-prepare reaches the same stale statement. Unprepared, a parameterised query costs two
 * round trips (describe, then execute), so writes keep their statements few.
 */
export function createDbClient(url: string) {
  // Notices ("schema already exists, skipping") are not errors and would bypass the logger.
  const client = postgres(url, { prepare: false, onnotice: () => {} })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}
