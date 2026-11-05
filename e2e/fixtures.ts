import { test as base, expect, type ConsoleMessage } from '@playwright/test'

export type ExpectedConsoleError = {
  /** The exact console text. */
  text: string
  /** The URL the message is about, so the same text from another resource still fails. */
  url: RegExp
}

type Options = {
  /** Console errors a test causes on purpose, such as a page answering 404. */
  expectedConsoleErrors: ExpectedConsoleError[]
}

export const notFoundStatus =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'

export function isExpected(message: ConsoleMessage, expected: ExpectedConsoleError[]): boolean {
  const url = message.location().url
  return expected.some((entry) => entry.text === message.text() && entry.url.test(url))
}

// Every test fails on a browser console error or an uncaught exception, so runtime
// problems surface in the gates instead of in production.
export const test = base.extend<Options>({
  expectedConsoleErrors: [[], { option: true }],
  page: async ({ page, expectedConsoleErrors }, runTest) => {
    const problems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && !isExpected(message, expectedConsoleErrors)) {
        problems.push(`${message.text()} (${message.location().url})`)
      }
    })
    page.on('pageerror', (error) => problems.push(error.message))
    await runTest(page)
    expect(problems, 'browser console errors').toEqual([])
  },
})

export { expect }
