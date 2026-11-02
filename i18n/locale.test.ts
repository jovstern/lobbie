import { describe, expect, it } from 'vitest'
import { dirFor, localeInPath } from '@/i18n/locale'

describe('dirFor', () => {
  it.each([
    ['he', 'rtl'],
    ['en', 'ltr'],
  ] as const)('%s is written %s', (locale, dir) => {
    expect(dirFor(locale)).toBe(dir)
  })
})

describe('localeInPath', () => {
  it.each([
    ['/en', 'en'],
    ['/en/money', 'en'],
    ['/he', 'he'],
    ['/he/money', 'he'],
    ['/', null],
    ['/money', null],
    ['/english', null],
    ['/env/x', null],
    ['', null],
  ] as const)('%j names %j', (pathname, locale) => {
    expect(localeInPath(pathname)).toBe(locale)
  })
})
