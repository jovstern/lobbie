import { createHmac } from 'node:crypto'
import { requireEnv } from '@/app/lib/env'

/**
 * The characters of an invite code: digits and capitals without 0, O, 1, I and L, so a code
 * read aloud or copied by hand is never misread. Both sides of each lookalike pair are left
 * out, so no character needs to be mapped to another when a code is typed.
 */
export const inviteAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

const codeLength = 10
// The largest multiple of the alphabet's size under 256: bytes from it up are drawn again, so
// every character is equally likely.
const unbiasedLimit = 256 - (256 % inviteAlphabet.length)
const codePattern = new RegExp(`^[${inviteAlphabet}]{${codeLength}}$`)

/** A new random code: 10 characters, about 50 bits. */
export function generateInviteCode(): string {
  let code = ''
  while (code.length < codeLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(codeLength * 2))) {
      if (byte < unbiasedLimit && code.length < codeLength) {
        code += inviteAlphabet[byte % inviteAlphabet.length]
      }
    }
  }
  return code
}

/** A code as typed or pasted: upper case, without spaces or dashes of any kind. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s\-‐-―]/g, '')
}

/** Whether a normalized code has the shape of one; it may still be unknown. */
export function isInviteCode(code: string): boolean {
  return codePattern.test(code)
}

/** The code as people read it: `ABCDE-23456`. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

// Keeps invite hashes apart from any other use of the auth secret.
const keyLabel = 'lobbie:invite-code'

/**
 * What the database keeps instead of the code: an HMAC-SHA-256 under a key derived from
 * BETTER_AUTH_SECRET, in hex. Without the secret a leaked table cannot be checked against
 * guesses, and no new variable is needed. The secret is read here, at use, never at import.
 */
export function hashInviteCode(code: string): string {
  const key = createHmac('sha256', requireEnv('BETTER_AUTH_SECRET')).update(keyLabel).digest()
  return createHmac('sha256', key).update(code).digest('hex')
}

/**
 * The link the admin shares. No locale prefix: neighbours choose their own language, and the
 * proxy sends someone who chose English to `/en/join/…`.
 */
export function inviteLink(appUrl: string, code: string): string {
  return `${new URL(appUrl).origin}/join/${code}`
}
