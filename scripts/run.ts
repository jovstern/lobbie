import { pathToFileURL } from 'node:url'
import { logger } from '@/app/lib/logger'

/** True when the module at `moduleUrl` was started from the command line, not imported. */
export function isEntryPoint(moduleUrl: string): boolean {
  const entry = process.argv[1]
  return entry !== undefined && moduleUrl === pathToFileURL(entry).href
}

/** Runs a script's body, logging one line for success or failure and setting the exit code. */
export async function runScript(name: string, main: () => Promise<void>): Promise<void> {
  try {
    await main()
    logger.info(`${name}: done`)
  } catch (err) {
    logger.error(`${name}: failed`, { err })
    process.exitCode = 1
  }
}
