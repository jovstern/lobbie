import { expect, test } from './fixtures'

test('greets the user by name', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByRole('button', { name: 'Say hello' }).click()
  await expect(page.getByText('Hello, Ada!')).toBeVisible()
})

test('asks for a name when none is given', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Say hello' }).click()
  await expect(page.getByText('Enter your name')).toBeVisible()
})
