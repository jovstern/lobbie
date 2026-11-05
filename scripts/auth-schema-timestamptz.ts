import { readFile, writeFile } from 'node:fs/promises'
import { isEntryPoint, runScript } from './run'

/**
 * Better Auth generates `timestamp("x")`, which is `timestamp without time zone`; every time
 * in this app is `timestamptz` (spec §5), and the Drizzle adapter supports it on Postgres.
 * Run after `auth generate` so the change survives regeneration.
 */
export function withTimeZones(source: string): string {
  return source.replace(/timestamp\((["'][a-z_]+["'])\)/g, 'timestamp($1, { withTimezone: true })')
}

if (isEntryPoint(import.meta.url)) {
  void runScript('auth:generate timestamptz', async () => {
    const file = process.argv[2]
    if (!file) throw new Error('Usage: auth-schema-timestamptz.ts <schema file>')
    await writeFile(file, withTimeZones(await readFile(file, 'utf8')))
  })
}
