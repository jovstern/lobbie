import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn } from './helpers/auth'
import { messages } from './helpers/copy'
import { addResident, deleteUser } from './helpers/db'

// The M1 demo flow (plan, M1): sign in by magic link, see the five-second Home in Hebrew,
// switch to English, then dark mode. The pauses let a viewer of the recorded GIF follow it.
// Someone new in apartment 9, which is behind, so resident9 keeps their sign-ins for the
// other specs (see helpers/auth.ts).

test('M1 demo: magic-link sign-in to the five-second Home, he → en → dark', async ({
  page,
}, testInfo) => {
  const overdueResident = `demo-${testInfo.project.name}@example.com`
  await addResident(overdueResident, `הדגמה ${testInfo.project.name}`, '9')
  try {
    await demo(page, overdueResident)
  } finally {
    await deleteUser(overdueResident)
  }
})

async function demo(page: Page, overdueResident: string) {
  await page.goto('/sign-in')
  await page.waitForTimeout(1000)

  await signIn(page, overdueResident)
  const status = page.getByRole('region', { name: messages.he.StatusCard.title, exact: true })
  await expect(status.getByText(messages.he.StatusCard.overdue, { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.waitForTimeout(2000)

  await page.getByRole('banner').getByRole('link', { name: 'English', exact: true }).click()
  await expect(page).toHaveURL('/en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(
    page
      .getByRole('region', { name: messages.en.StatusCard.title, exact: true })
      .getByText(messages.en.StatusCard.overdue, { exact: true }),
  ).toBeVisible()
  await page.waitForTimeout(2000)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(2000)
}
