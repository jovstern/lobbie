import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appSections, isAppPage } from '@/app/lib/utils/app-sections'

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
