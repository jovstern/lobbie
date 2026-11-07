import { expect, type Page } from '@playwright/test'
import { messages } from './copy'

/**
 * Refreshes the app's cached fund after a test wrote money straight to the database (behind
 * the app's back, so no cache tag was updated): the admin saves the building details
 * unchanged, a write that updates the building's tag. The page must have the admin's session.
 */
export async function refreshFundCache(page: Page) {
  // English, by its prefix: whichever language the test's cookie last chose, the page is this.
  const text = messages.en
  await page.goto('/en/admin/building')
  await page.getByRole('button', { name: text.BuildingForm.save, exact: true }).click()
  await expect(page.getByText(text.BuildingForm.saved, { exact: true })).toBeVisible()
}
