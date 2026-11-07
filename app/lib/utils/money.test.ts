import { describe, expect, it } from 'vitest'
import { agorotToShekelsInput, formatAgorot, formatShare, parseShekelsToAgorot } from './money'

// The Hebrew format carries a right-to-left mark and a non-breaking space, so expectations
// come from Intl itself rather than from hard-coded invisible characters.
const ils = (locale: string, fractionDigits: number) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

describe('formatAgorot', () => {
  it.each([
    ['he', 'he-IL', 35_000, 350, 0],
    ['he', 'he-IL', 35_050, 350.5, 2],
    ['he', 'he-IL', 123_456_789, 1_234_567.89, 2],
    ['he', 'he-IL', 0, 0, 0],
    ['he', 'he-IL', -50_000, -500, 0],
    ['en', 'en-IL', 35_000, 350, 0],
    ['en', 'en-IL', 35_050, 350.5, 2],
    ['en', 'en-IL', 5, 0.05, 2],
    ['en', 'en-IL', 123_456_700, 1_234_567, 0],
    ['en', 'en-IL', -1_299, -12.99, 2],
  ] as const)('%s: %i agorot', (locale, intlLocale, agorot, shekels, fractionDigits) => {
    expect(formatAgorot(agorot, locale)).toBe(ils(intlLocale, fractionDigits).format(shekels))
  })

  it('shows whole shekels without decimals and the rest with two', () => {
    expect(formatAgorot(35_000, 'en')).toBe('₪350')
    expect(formatAgorot(35_050, 'en')).toBe('₪350.50')
    expect(formatAgorot(123_456, 'en')).toBe('₪1,234.56')
  })

  it('puts the shekel sign after the number in Hebrew', () => {
    const formatted = formatAgorot(35_050, 'he').replace(/[\p{Cf}\s]/gu, '')
    expect(formatted).toBe('350.50₪')
  })

  it('marks both signs when signed, as a change to a balance', () => {
    expect(formatAgorot(25_000, 'en', { signed: true })).toBe('+₪250')
    expect(formatAgorot(-12_050, 'en', { signed: true })).toBe('-₪120.50')
    expect(formatAgorot(25_000, 'en')).toBe('₪250')
  })
})

describe('parseShekelsToAgorot', () => {
  it.each([
    ['350', 35_000],
    ['350.5', 35_050],
    ['350.50', 35_050],
    ['350.05', 35_005],
    ['1,234.56', 123_456],
    ['1,234,567', 123_456_700],
    ['  350  ', 35_000],
    ['0', 0],
    ['0.01', 1],
    ['0.29', 29],
    ['19.99', 1_999],
    ['10000000', 1_000_000_000],
    ['10,000,000.00', 1_000_000_000],
    // Floating point would give 1_005.9999… for 10.06 × 100; the parser never multiplies floats.
    ['10.06', 1_006],
    ['4.35', 435],
  ])('%j is %i agorot', (input, expected) => {
    const parsed = parseShekelsToAgorot(input)
    expect(parsed).toBe(expected)
    expect(Number.isInteger(parsed)).toBe(true)
  })

  it.each([
    [''],
    ['   '],
    ['-350'],
    ['-0.5'],
    ['350.505'],
    ['1.005'],
    ['350.'],
    ['.5'],
    ['abc'],
    ['NaN'],
    ['Infinity'],
    ['1e3'],
    ['350 ₪'],
    ['12,34'],
    ['1,2345'],
    [',350'],
    ['10000000.01'],
    ['99999999999'],
  ])('rejects %j', (input) => {
    expect(parseShekelsToAgorot(input)).toBeNull()
  })
})

describe('agorotToShekelsInput', () => {
  it.each([
    [35_000, '350'],
    [35_050, '350.50'],
    [35_005, '350.05'],
    [123_456, '1234.56'],
    [1, '0.01'],
    [70_000, '700'],
  ])('%i agorot is typed as %j', (agorot, expected) => {
    expect(agorotToShekelsInput(agorot)).toBe(expected)
  })

  it('reads back as the same agorot', () => {
    for (const agorot of [1, 99, 100, 35_050, 123_456, 1_000_000_000]) {
      expect(parseShekelsToAgorot(agorotToShekelsInput(agorot))).toBe(agorot)
    }
  })
})

describe('formatShare', () => {
  const percent = (locale: string, share: number, fractionDigits = 0) =>
    new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: fractionDigits,
    }).format(share)

  it.each([
    ['a whole share', 20_000, 25_000, 0.8],
    ['rounded to a whole percent', 1, 3, 1 / 3],
    ['everything', 5_000, 5_000, 1],
  ])('%s', (_, part, whole, share) => {
    expect(formatShare(part, whole, 'en')).toBe(percent('en-IL', share))
    expect(formatShare(part, whole, 'he')).toBe(percent('he-IL', share))
  })

  it('keeps a decimal under 1%, so a part that is there does not read as 0%', () => {
    expect(formatShare(4, 1_000, 'en')).toBe(percent('en-IL', 0.004, 1))
    expect(formatShare(4, 1_000, 'en')).not.toBe(percent('en-IL', 0))
  })
})
