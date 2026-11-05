import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDbClient } from '@/app/lib/db-client'
import { requireEnv } from '@/app/lib/env'
import { runScript } from './run'

void runScript('db:migrate', async () => {
  const { db, close } = createDbClient(requireEnv('DATABASE_URL'))
  try {
    await migrate(db, { migrationsFolder: 'drizzle' })
  } finally {
    await close()
  }
})
