import { createHash } from 'node:crypto'
import path from 'node:path'

/**
 * Where the local storage driver keeps files: a folder of `.data/uploads/` (git-ignored) per
 * database, named by a hash of its connection string. A file belongs with the rows that point
 * at it, so the e2e server (on the test branch) never writes among the dev server's files, and
 * the e2e specs find theirs. The hash never shows the connection string.
 */
export function uploadsRoot(databaseUrl: string, cwd: string = process.cwd()): string {
  const database = createHash('sha256').update(databaseUrl).digest('hex').slice(0, 16)
  return path.join(cwd, '.data', 'uploads', database)
}
