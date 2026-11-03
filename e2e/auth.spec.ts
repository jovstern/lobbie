import { existsSync, readdirSync } from 'node:fs'
import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages } from './helpers/copy'

const outbox = '.data/outbox'

test.describe('signed out', () => {
  test('/ redirects to sign-in, remembering where to return', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/sign-in?next=%2F')
    await expect(page.getByRole('heading', { level: 1, name: 'כניסה ללובי' })).toBeVisible()
  })

  test('an English page redirects to the English sign-in', async ({ page }) => {
    await page.goto('/en/money?month=2026-10')
    await expect(page).toHaveURL('/en/sign-in?next=%2Fen%2Fmoney%3Fmonth%3D2026-10')
  })

  test('/join sends a signed-out visitor to sign-in', async ({ page }) => {
    await page.goto('/join')
    await expect(page).toHaveURL('/sign-in?next=%2Fjoin')
  })
})

test.describe('the sign-in page', () => {
  test('in Hebrew, has the labelled email field and the send button', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/sign-in')
    await expect(page.getByLabel('אימייל')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('אימייל')).toHaveAttribute('autocomplete', 'email')
    await expect(page.getByRole('button', { name: 'שלחו לי קישור' })).toBeVisible()
    // The tagline panel is for wide screens; phones show the wordmark instead.
    const tagline = page.getByText('כולם תחת קורת גג אחת')
    await (isMobile ? expect(tagline).toBeHidden() : expect(tagline).toBeVisible())
  })

  test('in English, has the labelled email field and the send button', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/en/sign-in')
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible()
    const tagline = page.getByText('Everyone under one roof')
    await (isMobile ? expect(tagline).toBeHidden() : expect(tagline).toBeVisible())
  })

  test('explains an expired link', async ({ page }) => {
    await page.goto('/en/sign-in?error=INVALID_TOKEN')
    await expect(page.getByRole('status')).toHaveText(
      'That sign-in link has expired or was already used. Enter your email to get a new one.',
    )
  })

  test('check-email links back to sign-in', async ({ page }) => {
    const text = messages.en.CheckEmail
    await page.goto('/en/sign-in/check-email')
    await expect(page.getByRole('heading', { level: 1, name: text.title })).toBeVisible()
    // Opened directly, with no flash cookie, the page says it in general terms.
    await expect(page.getByRole('main')).toContainText(text.body)
    await page.getByRole('link', { name: text.differentEmail }).click()
    await expect(page).toHaveURL('/en/sign-in')
  })
})

test('the HTTP endpoint for requesting a link is disabled, so the rate limits cannot be skipped', async ({
  request,
  baseURL,
}) => {
  const recipient = `e2e-http-${Date.now()}@example.com`

  const response = await request.post('/api/auth/sign-in/magic-link', {
    headers: { origin: baseURL ?? '' },
    data: { email: recipient },
  })

  expect(response.status()).toBe(404)
  const sent = existsSync(outbox)
    ? readdirSync(outbox).filter((name) => name.includes(recipient))
    : []
  expect(sent).toEqual([])
})

test('the proxy renews an expired session cache once, then serves pages from it', async ({
  page,
  context,
}) => {
  await useSessionOf(page, 'resident1@example.com')
  // As if five minutes had passed: the browser has dropped the cache cookie.
  await context.clearCookies({ name: /session_data/ })

  const renewal = await page.goto('/en')
  const renewed = (await renewal?.headersArray()) ?? []
  const cacheCookies = renewed.filter(
    ({ name, value }) => name.toLowerCase() === 'set-cookie' && value.includes('session_data='),
  )
  // One Set-Cookie for it: the proxy's, with no second copy from Better Auth's Next plugin.
  expect(cacheCookies).toHaveLength(1)
  expect(cacheCookies[0].value).toContain('Max-Age=300')

  const next = await page.goto('/en/more')
  const again = (await next?.headersArray()) ?? []
  expect(again.some(({ value }) => value.includes('session_data='))).toBe(false)
})
