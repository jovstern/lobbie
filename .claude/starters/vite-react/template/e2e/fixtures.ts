import { test as base, expect } from '@playwright/test'

// Every test fails on a browser console error or an uncaught exception, so runtime
// problems surface in the gates instead of in production.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    const problems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    page.on('pageerror', (error) => problems.push(error.message))
    await runTest(page)
    expect(problems, 'browser console errors').toEqual([])
  },
})

export { expect }
