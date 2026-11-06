import { describe, expect, it } from 'vitest'
import { displayName, hasGivenName } from '@/app/lib/utils/display-name'

describe('displayName', () => {
  it('is the name, trimmed', () => {
    expect(displayName({ name: '  נועה לוי ', email: 'noa@example.com' })).toBe('נועה לוי')
  })

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['missing', null],
  ])('is the email when the name is %s', (_case, name) => {
    expect(displayName({ name, email: 'new@example.com' })).toBe('new@example.com')
  })
})

describe('hasGivenName', () => {
  it('is true for a name, false for an empty, blank or missing one', () => {
    expect(hasGivenName({ name: 'Noa' })).toBe(true)
    expect(hasGivenName({ name: ' ' })).toBe(false)
    expect(hasGivenName({ name: '' })).toBe(false)
    expect(hasGivenName({ name: null })).toBe(false)
  })
})
