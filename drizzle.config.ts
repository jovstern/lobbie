import { defineConfig } from 'drizzle-kit'

// `generate` needs no database; `studio` reads DATABASE_URL (loaded from .env.local by the
// npm script). Migrations are applied by scripts/migrate.ts, not drizzle-kit.
const url = process.env.DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  schema: './app/lib/schema.ts',
  out: './drizzle',
  ...(url ? { dbCredentials: { url } } : {}),
})
