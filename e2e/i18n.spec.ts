import { notFoundStatus, expect, test } from './fixtures'

const hebrewHeading = 'כל מה שקורה בבניין, במקום אחד'
const englishHeading = 'Everything in your building, in one place'

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' })

  test('/ is Hebrew, right to left: Hebrew is the default', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1, name: hebrewHeading })).toBeVisible()
    await expect(page).toHaveTitle('לובי')
  })

  test('/en is English, left to right, and is remembered', async ({ page, context }) => {
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1, name: englishHeading })).toBeVisible()
    await expect(page).toHaveTitle('Lobbie')
    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en')
  })
})

test('a saved English choice sends / to /en', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: baseURL }])
  await page.goto('/')
  await expect(page).toHaveURL('/en')
  await expect(page.getByRole('heading', { level: 1, name: englishHeading })).toBeVisible()
})

test('/he redirects to / and saves Hebrew', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: baseURL }])
  await page.goto('/he')
  await expect(page).toHaveURL('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('he')
})

test.describe('unknown paths', () => {
  // Chrome reports each document's 404 status as a console error; here it is the point.
  test.use({
    expectedConsoleErrors: [
      { text: notFoundStatus, url: /\/(en\/)?no-such-page$|\/missing-file\.txt$/ },
    ],
  })

  test('show the Hebrew 404 with a way home', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1, name: 'הדף לא נמצא' })).toBeVisible()
    await expect(page).toHaveTitle('הדף לא נמצא | לובי')
    await page.getByRole('link', { name: 'חזרה לדף הבית' }).click()
    await expect(page).toHaveURL('/')
  })

  test('show the English 404 under /en', async ({ page }) => {
    const response = await page.goto('/en/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveTitle('Page not found | Lobbie')
    await page.getByRole('link', { name: 'Back to home' }).click()
    await expect(page).toHaveURL('/en')
  })

  test('outside the locale routes show the bilingual 404', async ({ page }) => {
    const response = await page.goto('/missing-file.txt')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.getByRole('heading', { level: 1, name: 'הדף לא נמצא' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveTitle('הדף לא נמצא | לובי')
  })
})
