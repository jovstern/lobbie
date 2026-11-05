import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from '@/app/lib/utils/phone'

describe('normalizePhone', () => {
  it.each([
    // Mobile, as people type it.
    ['050-555-0101', '+972505550101'],
    ['050-5550101', '+972505550101'],
    ['0505550101', '+972505550101'],
    ['050 555 0101', '+972505550101'],
    ['  054-555 03-01  ', '+972545550301'],
    // International.
    ['+972505550101', '+972505550101'],
    ['+972 50-555-0101', '+972505550101'],
    ['+972-50-555-0101', '+972505550101'],
    // A trunk 0 kept after the country code, as some write it.
    ['+972 050 555 0101', '+972505550101'],
    // Landlines and 07X numbers.
    ['03-555-0101', '+97235550101'],
    ['02 5550101', '+97225550101'],
    ['077-555-0101', '+972775550101'],
  ])('%j → %s', (typed, e164) => {
    expect(normalizePhone(typed)).toBe(e164)
  })

  it.each([
    '',
    '   ',
    'phone',
    '050-555-010',
    '050-555-01011',
    '055',
    // Not an Israeli number.
    '+1 202 555 0101',
    '+44 20 7946 0958',
    // A country code without its +.
    '972505550101',
    // An area code Israel does not use.
    '01-555-0101',
    '06-555-0101',
    // Only spaces and dashes separate digits.
    '(050) 555-0101',
    '050.555.0101',
    '050/5550101',
    '+972+505550101',
    '050-555-0101 ext 2',
  ])('refuses %j', (typed) => {
    expect(normalizePhone(typed)).toBeNull()
  })
})

describe('formatPhone', () => {
  it.each([
    ['+972505550101', '050-555-0101'],
    ['+972775550101', '077-555-0101'],
    ['+97235550101', '03-555-0101'],
    // Saved before numbers were normalised: shown the same way.
    ['054-5550301', '054-555-0301'],
  ])('%s → %s', (saved, shown) => {
    expect(formatPhone(saved)).toBe(shown)
  })

  it('shows a number it cannot read as it was saved', () => {
    expect(formatPhone('+1 202 555 0101')).toBe('+1 202 555 0101')
  })
})
