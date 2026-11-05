import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appSections, carriesInviteCode, isAppPage, isJoinPage } from '@/app/lib/utils/app-sections'

const appRoutes = new URL('../../[locale]/(app)/', import.meta.url)

describe('appSections', () => {
  it('lists every top-level section of app/[locale]/(app)', () => {
    const folders = existsSync(appRoutes)
      ? readdirSync(appRoutes, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          // Route groups, private folders and parallel slots add no URL segment of their own.
          .map((entry) => entry.name)
          .filter((name) => !/^[(_@]/.test(name))
      : []

    for (const folder of folders) expect(appSections).toContain(`/${folder}`)
  })
})

describe('isAppPage', () => {
  it.each([
    ['/', true],
    ['/en', true],
    ['/money', true],
    ['/en/admin/payments', true],
    ['/sign-in', false],
    ['/en/sign-in/check-email', false],
    ['/join', false],
    ['/join/ABC', false],
    ['/welcome', false],
    ['/no-such-page', false],
    ['/moneybags', false],
  ] as const)('%s is an app page: %s', (path, expected) => {
    expect(isAppPage(path)).toBe(expected)
  })
})

describe('isJoinPage', () => {
  it.each([
    ['/join', true],
    ['/join/ABCDE23456', true],
    ['/en/join', true],
    ['/en/join/ABCDE23456', true],
    ['/joiner', false],
    ['/sign-in', false],
    ['/en', false],
  ] as const)('%s is a join page: %s', (path, expected) => {
    expect(isJoinPage(path)).toBe(expected)
  })
})

describe('carriesInviteCode', () => {
  it.each([
    ['/join/ABCDE23456', true],
    ['/en/join', true],
    ['/sign-in?next=%2Fjoin%2FABCDE23456', true],
    ['/en/sign-in?next=%2Fen%2Fjoin%2FABCDE23456', true],
    ['/sign-in?next=%2Fmoney', false],
    ['/sign-in', false],
    ['/money?next=%2Fjoin%2FABCDE23456', false],
  ] as const)('%s may carry a code: %s', (path, expected) => {
    expect(carriesInviteCode(new URL(path, 'http://localhost'))).toBe(expected)
  })
})
