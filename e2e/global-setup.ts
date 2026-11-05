import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { outboxDir } from './helpers/outbox'
import { sessionsDir } from './helpers/auth'

/**
 * Before the run: migrate, wipe and seed the test branch (the reset script refuses anything
 * but E2E_DATABASE_URL), and forget earlier emails and sessions.
 */
export default function globalSetup() {
  const reset = spawnSync('npx', ['tsx', '--conditions=react-server', 'scripts/reset-test-db.ts'], {
    stdio: 'inherit',
    env: process.env,
  })
  if (reset.status !== 0) throw new Error('Resetting the e2e database failed (see above).')

  rmSync(outboxDir, { recursive: true, force: true })
  rmSync(sessionsDir, { recursive: true, force: true })
}
