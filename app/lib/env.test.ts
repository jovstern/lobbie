import { describe, expect, it } from 'vitest'
import { requireEnv } from './env'

describe('requireEnv', () => {
  it('returns the value when the variable is set', () => {
    expect(requireEnv('DATABASE_URL', { DATABASE_URL: 'postgres://x' })).toBe('postgres://x')
  })

  it.each([
    ['missing', {}],
    ['empty', { DATABASE_URL: '' }],
    ['blank', { DATABASE_URL: '   ' }],
  ])('names the variable when it is %s', (_case, source) => {
    expect(() => requireEnv('DATABASE_URL', source)).toThrow(
      'DATABASE_URL is not set. Add it to .env.local (see .env.example).',
    )
  })
})
