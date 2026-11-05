import { describe, expect, it } from 'vitest'
import { localizedLanding, safeNextPath, withLocalePrefix } from '@/app/lib/utils/redirect'

describe('safeNextPath', () => {
  it.each([
    '/',
    '/money',
    '/en',
    '/en/money?month=2026-11',
    '/admin/payments#latest',
    '/schedule?q=%D7%A0%D7%99%D7%A7%D7%99%D7%95%D7%9F',
    '/a/b%2Fc',
  ])('keeps the relative path %j unchanged, locale included', (path) => {
    expect(safeNextPath(path)).toBe(path)
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with a path', '//evil.com/en/money'],
    ['backslash after the slash', '/\\evil.com'],
    ['backslash anywhere', '/money\\..\\evil'],
    ['absolute http URL', 'https://evil.com/'],
    ['absolute URL to this host', 'http://localhost:3100/'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:text/html,hi'],
    ['no leading slash', 'money'],
    ['empty string', ''],
    ['whitespace before the slash', ' /money'],
    ['tab inside', '/\t/evil.com'],
    ['newline inside', '/money\nSet-Cookie: x'],
    ['null byte', '/money\u0000'],
    ['DEL character', '/money\u007f'],
    ['encoded double slash', '/%2F%2Fevil.com'],
    ['encoded slash after the slash', '/%2Fevil.com'],
    ['encoded backslash', '/%5Cevil.com'],
    ['encoded control character', '/money%0d%0aSet-Cookie:x'],
    ['malformed encoding', '/%E0%A4%A'],
  ])('rejects a %s', (_label, input) => {
    expect(safeNextPath(input)).toBe('/')
  })

  it.each([undefined, null, 42, ['/money'], { path: '/money' }])(
    'rejects the non-string %j',
    (input) => {
      expect(safeNextPath(input)).toBe('/')
    },
  )

  it('returns the given fallback when the input is rejected', () => {
    expect(safeNextPath('//evil.com', '/en')).toBe('/en')
  })
})

describe('withLocalePrefix', () => {
  it.each([
    ['/', 'he', '/'],
    ['/money', 'he', '/money'],
    ['/', 'en', '/en'],
    ['/money?month=2026-11', 'en', '/en/money?month=2026-11'],
    ['/?tab=1', 'en', '/en?tab=1'],
    ['/en/money', 'en', '/en/money'],
    ['/en/money', 'he', '/en/money'],
    ['/he/money', 'en', '/he/money'],
    ['/en?tab=1', 'en', '/en?tab=1'],
    ['/#top', 'en', '/en#top'],
  ] as const)('%j in %s is %j', (path, locale, expected) => {
    expect(withLocalePrefix(path, locale)).toBe(expected)
  })
})

describe('localizedLanding', () => {
  const base = 'http://localhost:3100'

  it.each([
    ['/', 'en', `${base}/en`, 'en'],
    [`${base}/money?apartment=2`, 'en', `${base}/en/money?apartment=2`, 'en'],
    [`${base}/money`, 'he', `${base}/money`, 'he'],
    // A page that names its language keeps it: the person chose it there.
    [`${base}/en/money`, 'he', `${base}/en/money`, 'en'],
    // A value the app does not know reads as Hebrew.
    [`${base}/money`, 'fr', `${base}/money`, 'he'],
    [`${base}/money`, null, `${base}/money`, 'he'],
  ])('%s with %j lands on %s in %s', (location, saved, url, locale) => {
    expect(localizedLanding(location, base, saved)).toEqual({ url, locale })
  })
})
