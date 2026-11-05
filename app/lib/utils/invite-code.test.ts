import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteAlphabet,
  inviteLink,
  isInviteCode,
  normalizeInviteCode,
} from './invite-code'

describe('generateInviteCode', () => {
  it('is 10 characters of the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode()
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/)
      expect(isInviteCode(code)).toBe(true)
    }
  })

  it('never uses a character that looks like another', () => {
    expect(inviteAlphabet).toHaveLength(31)
    for (const lookalike of ['0', 'O', '1', 'I', 'L']) {
      expect(inviteAlphabet).not.toContain(lookalike)
    }
  })

  it('differs each time', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()))
    expect(codes.size).toBe(500)
  })

  it('reaches every character of the alphabet', () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateInviteCode()).join(''))
    expect(seen.size).toBe(inviteAlphabet.length)
  })
})

describe('normalizeInviteCode', () => {
  it.each([
    ['ABCDE-23456', 'ABCDE23456'],
    ['abcde 23456', 'ABCDE23456'],
    ['  abc-de 234–56 ', 'ABCDE23456'],
    ['ABCDE23456', 'ABCDE23456'],
  ])('reads %j as %j', (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected)
  })
})

describe('isInviteCode', () => {
  it.each(['', 'ABCDE2345', 'ABCDE234567', 'ABCDE2345O', 'ABCDE-23456', 'abcde23456'])(
    'refuses %j',
    (input) => {
      expect(isInviteCode(input)).toBe(false)
    },
  )
})

describe('formatInviteCode', () => {
  it('splits the code in two groups of five', () => {
    expect(formatInviteCode('ABCDE23456')).toBe('ABCDE-23456')
  })
})

describe('hashInviteCode', () => {
  const secret = 'test-only-secret-for-invite-hashes'
  beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', secret))
  afterEach(() => vi.unstubAllEnvs())

  it('is an HMAC-SHA-256 under a key derived from the auth secret, in hex', () => {
    const key = createHmac('sha256', secret).update('lobbie:invite-code').digest()
    expect(hashInviteCode('ABCDE23456')).toBe(
      createHmac('sha256', key).update('ABCDE23456').digest('hex'),
    )
    expect(hashInviteCode('ABCDE23456')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes with the secret, so a leaked table cannot be checked without it', () => {
    const before = hashInviteCode('ABCDE23456')
    vi.stubEnv('BETTER_AUTH_SECRET', 'another-secret')
    expect(hashInviteCode('ABCDE23456')).not.toBe(before)
  })

  it('names the missing secret, never a value', () => {
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect(() => hashInviteCode('ABCDE23456')).toThrow('BETTER_AUTH_SECRET is not set')
  })
})

describe('inviteLink', () => {
  it('is the join page on the app’s origin, with no locale prefix', () => {
    expect(inviteLink('https://lobbie.example/some/path', 'ABCDE23456')).toBe(
      'https://lobbie.example/join/ABCDE23456',
    )
  })
})
