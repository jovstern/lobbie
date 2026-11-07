import { rm } from 'node:fs/promises'
import path from 'node:path'
import { uploadsRoot } from '@/app/lib/utils/uploads-root'

/**
 * Removes a file the e2e server stored. Its local storage keeps files per database
 * (`uploadsRoot`), so the e2e server's live in the test branch's own folder, apart from dev's.
 */
export async function removeUpload(key: string): Promise<void> {
  const url = process.env.E2E_DATABASE_URL
  if (!url) throw new Error('E2E_DATABASE_URL is not set.')
  await rm(path.join(uploadsRoot(url), path.basename(key)), { force: true })
}
