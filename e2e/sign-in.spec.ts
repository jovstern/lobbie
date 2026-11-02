import { expect, test } from './fixtures'
import { asNewClient, signIn } from './helpers/auth'

// Each test signs in a different e2e person, so a run stays inside the per-email limit.

test('a resident requests a link, opens it and lands on Home', async ({ page }) => {
  await signIn(page, 'e2e1@example.com')

  await expect(page.getByRole('region', { name: 'התשלומים שלכם', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'קופת הבניין', exact: true })).toBeVisible()
})

test('an unknown email still reaches check-email, revealing nothing', async ({
  page,
}, testInfo) => {
  await asNewClient(page)
  await page.goto('/en/sign-in')

  await page
    .getByLabel('Email', { exact: true })
    .fill(`nobody-${testInfo.project.name}@example.com`)
  await page.getByRole('button', { name: 'Send me a link', exact: true }).click()

  await expect(page).toHaveURL('/en/sign-in/check-email')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Check your email', exact: true }),
  ).toBeVisible()
})

test('a signed-out visit to /more comes back to /more after signing in', async ({ page }) => {
  await page.goto('/more')
  await expect(page).toHaveURL('/sign-in?next=%2Fmore')

  await signIn(page, 'e2e2@example.com', { landing: '/more' })

  await expect(page.getByRole('heading', { level: 1, name: 'עוד', exact: true })).toBeVisible()
})

test('signing out returns to sign-in, Home asks to sign in again, and the used link is expired', async ({
  page,
}) => {
  const link = await signIn(page, 'e2e3@example.com', { locale: 'en' })

  await page.goto('/en/more')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL('/en/sign-in')

  await page.goto('/en')
  await expect(page).toHaveURL('/en/sign-in?next=%2Fen')

  await page.goto(link)
  await expect(page).toHaveURL('/en/sign-in?error=INVALID_TOKEN')
  await expect(page.getByRole('status')).toHaveText(
    'That sign-in link has expired or was already used. Enter your email to get a new one.',
  )
})
