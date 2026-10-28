import { expect, test } from './fixtures'

test('greeting form works end to end', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Name').fill('Ada')
  await page.getByRole('button', { name: 'Greet' }).click()
  await expect(page.getByRole('status')).toHaveText('Hello, Ada!')
})
