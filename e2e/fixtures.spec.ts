import { test as base, expect, type ConsoleMessage } from '@playwright/test'
import { isExpected, notFoundStatus } from './fixtures'

// Uses the plain Playwright test: the point is to see the errors the fixture would report.
base('an allowed 404 covers only its own URL, not other missing resources', async ({ page }) => {
  const errors: ConsoleMessage[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message)
  })
  const expected = [{ text: notFoundStatus, url: /\/no-such-page$/ }]

  await page.goto('/no-such-page')
  await page.evaluate(async () => {
    const image = new Image()
    image.src = '/missing-image.png'
    await new Promise((resolve) => image.addEventListener('error', resolve))
  })

  const byUrl = (pattern: RegExp) => errors.filter((e) => pattern.test(e.location().url))
  await expect.poll(() => byUrl(/missing-image\.png$/).length).toBe(1)
  expect(byUrl(/\/no-such-page$/).every((e) => isExpected(e, expected))).toBe(true)
  expect(byUrl(/missing-image\.png$/).some((e) => isExpected(e, expected))).toBe(false)
})
