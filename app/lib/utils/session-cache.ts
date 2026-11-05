import { parseCookies } from 'better-auth/cookies'

// Better Auth's cookie names, with the `__Secure-` prefix it adds on https.
const prefixes = ['__Secure-better-auth.', 'better-auth.']

function cookieNamed(cookies: Map<string, string>, name: string): string | undefined {
  for (const prefix of prefixes) {
    const whole = cookies.get(`${prefix}${name}`)
    if (whole) return whole
    // A value too long for one cookie is split into `<name>.0`, `<name>.1`, …
    const chunks = [...cookies]
      .filter(([key]) => key.startsWith(`${prefix}${name}.`))
      .map(([key, value]) => ({ index: Number(key.slice(key.lastIndexOf('.') + 1)), value }))
      .sort((a, b) => a.index - b.index)
    if (chunks.length > 0) return chunks.map((chunk) => chunk.value).join('')
  }
  return undefined
}

// The "compact" cache cookie is base64url JSON with an `expiresAt` in milliseconds.
function expiresAtOf(cacheCookie: string): number | null {
  try {
    const base64 = cacheCookie.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof payload !== 'object' || payload === null || !('expiresAt' in payload)) return null
    return typeof payload.expiresAt === 'number' ? payload.expiresAt : null
  } catch {
    return null
  }
}

/**
 * Whether the proxy should renew the session cache cookie: there is a session, but its signed
 * copy (Better Auth's cookie cache) is missing, expired or unreadable, so every page would
 * read the session from the database. Only decides; the signature is checked by Better Auth.
 */
export function needsSessionCacheRenewal(cookieHeader: string | null, now = Date.now()): boolean {
  if (!cookieHeader) return false
  const cookies = parseCookies(cookieHeader)
  if (!cookieNamed(cookies, 'session_token')) return false
  const cache = cookieNamed(cookies, 'session_data')
  if (!cache) return true
  const expiresAt = expiresAtOf(cache)
  return expiresAt === null || expiresAt <= now
}
