import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDbClient } from '@/app/lib/db-client'
import { checkResetTarget } from './reset-guard'
import { runScript } from './run'
import { seed } from './seed'

// Wipes the e2e database (E2E_DATABASE_URL), then migrates and seeds it, with the e2e
// fixtures. Never the app's.
void runScript('db:reset-test', async () => {
  const target = checkResetTarget(process.env)
  if (!target.ok) throw new Error(target.reason)

  const { db, close } = createDbClient(target.url)
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(sql`CREATE SCHEMA public`)
    await migrate(db, { migrationsFolder: 'drizzle' })
    // With the e2e fixtures, which the dev seed never creates.
    await seed(db, { e2e: true })
  } finally {
    await close()
  }
})
