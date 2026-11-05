import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Db } from '@/app/lib/db-client'
import * as schema from '@/app/lib/schema'

const migrationsFolder = new URL('../../../drizzle', import.meta.url).pathname

/**
 * A fresh in-memory Postgres (PGlite) with the real migrations from `drizzle/` applied.
 * `gen_random_uuid()` is built into Postgres 13+, which PGlite is.
 *
 * Data tests share one instance per file and swap it in for the app's database:
 *
 *   const testDb = await vi.hoisted(async () => {
 *     const { createTestDb } = await import('@/app/lib/test/db')
 *     return createTestDb()
 *   })
 *   vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
 *   afterAll(() => testDb.close())
 *
 * See `app/lib/test/db.test.ts`.
 */
export async function createTestDb(): Promise<{
  db: Db
  /** The PGlite instance itself, for a test that counts the queries a function sends. */
  client: PGlite
  close: () => Promise<void>
}> {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder })
  return { db, client, close: () => client.close() }
}
