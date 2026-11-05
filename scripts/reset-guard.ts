import { requireEnv } from '../app/lib/env'

type EnvSource = Record<string, string | undefined>

export type ResetTarget = { ok: true; url: string } | { ok: false; reason: string }

/**
 * Decides whether `E2E_DATABASE_URL` is safe to wipe. It must be set, and must not be the app
 * database, nor anything on the app database's host. Reasons name variables, never values.
 */
export function checkResetTarget(env: EnvSource): ResetTarget {
  let url: string
  try {
    url = requireEnv('E2E_DATABASE_URL', env)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }

  const host = hostOf(url)
  if (host === undefined) return { ok: false, reason: 'E2E_DATABASE_URL is not a valid URL.' }

  const appUrl = env.DATABASE_URL?.trim()
  // With no app database configured (CI, or a machine that only runs e2e) there is nothing
  // the test database could be confused with; the guard exists to protect DATABASE_URL.
  if (!appUrl) return { ok: true, url }
  if (appUrl === url) {
    return {
      ok: false,
      reason: 'E2E_DATABASE_URL is the same as DATABASE_URL; refusing to reset the app database.',
    }
  }
  if (hostOf(appUrl) === host) {
    return {
      ok: false,
      reason: 'E2E_DATABASE_URL has the same host as DATABASE_URL; refusing to reset it.',
    }
  }
  return { ok: true, url }
}

/**
 * The database host, normalised so one Neon branch compares equal whichever endpoint a URL
 * uses: `ep-x-pooler.region…` (pooled) and `ep-x.region…` (direct) are the same database.
 */
function hostOf(url: string): string | undefined {
  try {
    const { hostname } = new URL(url)
    if (!hostname) return undefined
    const [first, ...rest] = hostname.toLowerCase().split('.')
    return [first.replace(/-pooler$/, ''), ...rest].join('.')
  } catch {
    return undefined
  }
}
