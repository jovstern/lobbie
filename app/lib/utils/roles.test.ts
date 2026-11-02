import { describe, expect, it } from 'vitest'
import { hasRole } from '@/app/lib/utils/roles'

describe('hasRole', () => {
  it.each([
    ['resident', 'resident', true],
    ['resident', 'committee', false],
    ['resident', 'admin', false],
    ['committee', 'resident', true],
    ['committee', 'committee', true],
    ['committee', 'admin', false],
    ['admin', 'resident', true],
    ['admin', 'committee', true],
    ['admin', 'admin', true],
  ] as const)('%s meets a minimum of %s: %s', (role, min, expected) => {
    expect(hasRole(role, min)).toBe(expected)
  })
})
