import { expect, test } from './fixtures'
import { asNewClient, localePrefix, signIn } from './helpers/auth'
import { messages, translator } from './helpers/copy'

// Each test signs in a different e2e person, so a run stays inside the per-email limit.

const en = messages.en

test('a resident requests a link, opens it and lands on Home', async ({ page }) => {
  await signIn(page, 'e2e1@example.com')

  await expect(
    page.getByRole('region', { name: messages.he.StatusCard.title, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: messages.he.BalanceCard.title, exact: true }),
  ).toBeVisible()
})

for (const locale of ['he', 'en'] as const) {
  test(`an unknown email still reaches check-email, which names it without overflowing (${locale})`, async ({
    page,
  }, testInfo) => {
    const text = messages[locale]
    const prefix = localePrefix(locale)
    await asNewClient(page)
    await page.goto(`${prefix}/sign-in`)
    // Long enough to overflow a phone-width card unless it breaks.
    const address = `yoav.stern.vaad.bayit.rimon12.${locale}.${testInfo.project.name}@example.com`

    await page.getByLabel(text.SignInForm.emailLabel, { exact: true }).fill(address)
    await page.getByRole('button', { name: text.SignInForm.submit, exact: true }).click()

    // The address travels in a flash cookie, never in the URL.
    await expect(page).toHaveURL(`${prefix}/sign-in/check-email`)
    await expect(
      page.getByRole('heading', { level: 1, name: text.CheckEmail.title, exact: true }),
    ).toBeVisible()
    const sentence = translator(locale).markup('CheckEmail.sentTo', {
      email: address,
      address: (chunks) => chunks,
    })
    await expect(page.getByRole('main')).toContainText(sentence)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
}

test('a signed-out visit to /more comes back to /more after signing in', async ({ page }) => {
  await page.goto('/more')
  await expect(page).toHaveURL('/sign-in?next=%2Fmore')

  await signIn(page, 'e2e2@example.com', { landing: '/more' })

  await expect(
    page.getByRole('heading', { level: 1, name: messages.he.More.title, exact: true }),
  ).toBeVisible()
})

test('signing out returns to sign-in, Home asks to sign in again, and the used link is expired', async ({
  page,
}) => {
  const link = await signIn(page, 'e2e3@example.com', { locale: 'en' })

  await page.goto('/en/more')
  await page.getByRole('button', { name: en.Auth.signOut, exact: true }).click()
  await expect(page).toHaveURL('/en/sign-in?signedOut=1')
  // Signing in again is the only thing left to do, so the field has focus.
  await expect(page.getByLabel(en.SignInForm.emailLabel, { exact: true })).toBeFocused()

  await page.goto('/en')
  await expect(page).toHaveURL('/en/sign-in?next=%2Fen')

  await page.goto(link)
  await expect(page).toHaveURL('/en/sign-in?error=INVALID_TOKEN')
  await expect(page.getByRole('status')).toHaveText(en.SignIn.expired)
  // The notice is read first: an expired link does not move focus to the field.
  await expect(page.getByLabel(en.SignInForm.emailLabel, { exact: true })).not.toBeFocused()
})

test('signing out with an expired session cache still signs out', async ({
  page,
  context,
}, testInfo) => {
  // Someone new (so the seeded people stay within their per-email limit) lands on /join,
  // which has the sign-out button too.
  await signIn(page, `signout-${testInfo.project.name}@example.com`, {
    locale: 'en',
    landing: '/en/join',
  })
  // As if five minutes had passed: the browser drops the cache cookie, the session remains.
  await context.clearCookies({ name: /session_data/ })

  await page.getByRole('button', { name: en.Auth.signOut, exact: true }).click()
  await expect(page).toHaveURL('/en/sign-in?signedOut=1')

  await page.goto('/en')
  await expect(page).toHaveURL('/en/sign-in?next=%2Fen')
  const names = (await context.cookies()).map((cookie) => cookie.name)
  expect(names.filter((name) => name.includes('better-auth.session'))).toEqual([])
})
