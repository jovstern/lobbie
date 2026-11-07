import { rm } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDbClient } from '@/app/lib/db-client'
import { createStorage, localDriver } from '@/app/lib/storage'
import { uploadsRoot } from '@/app/lib/utils/uploads-root'
import { checkResetTarget } from './reset-guard'
import { runScript } from './run'
import { seed } from './seed'

// Wipes the e2e database (E2E_DATABASE_URL) and its receipt files, then migrates and seeds
// it, with the e2e fixtures. Never the app's.
void runScript('db:reset-test', async () => {
  const target = checkResetTarget(process.env)
  if (!target.ok) throw new Error(target.reason)

  const { db, close } = createDbClient(target.url)
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(sql`CREATE SCHEMA public`)
    // The files belong to the rows just dropped; the test branch has a folder of its own.
    const uploads = uploadsRoot(target.url)
    await rm(uploads, { recursive: true, force: true })
    await migrate(db, { migrationsFolder: 'drizzle' })
    // With the e2e fixtures, which the dev seed never creates.
    await seed(db, { e2e: true, removeReceipt: createStorage(localDriver(uploads)).remove })
  } finally {
    await close()
  }
})
