import { expect, test } from './fixtures'

test('the home page loads in Hebrew, right to left', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'לובי' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
