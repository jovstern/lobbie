import { expect, test } from './fixtures'
import { signIn, useSessionOf } from './helpers/auth'
import { messages } from './helpers/copy'
import { savedLocaleOf, setSavedLocaleOf } from './helpers/db'

// Its own person, so the language saved to the profile changes no one else's test.
const person = 'e2e2@example.com'

test('choosing English on the profile opens it in English, and the choice persists', async ({
  page,
  context,
}) => {
  await useSessionOf(page, person)
  try {
    await page.goto('/profile')
    const choice = (name: string) =>
      page.getByRole('main').getByRole('radio', { name, exact: true })
    await expect(choice(messages.he.LanguageChoice.he)).toBeChecked()

    // The radio itself is visually hidden; its label is what people press.
    await page.getByRole('main').getByText(messages.he.LanguageChoice.en, { exact: true }).click()

    // Back at the language section, in English, with focus on the choice. (The hash and the
    // focus are confirmed once e2e can run against the test database again.)
    await expect(page).toHaveURL('/en/profile#language')
    await expect(choice(messages.en.LanguageChoice.en)).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(choice(messages.en.LanguageChoice.en)).toBeChecked()
    expect(await savedLocaleOf(person)).toBe('en')
    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en')

    // The cookie sends an unprefixed address to English.
    await page.goto('/')
    await expect(page).toHaveURL('/en')

    // And back to Hebrew, from the keyboard.
    await page.goto('/en/profile')
    await choice(messages.en.LanguageChoice.en).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page).toHaveURL('/profile#language')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    expect(await savedLocaleOf(person)).toBe('he')
  } finally {
    await setSavedLocaleOf(person, 'he')
  }
})

test('a wrong phone is explained, focused and kept', async ({ page }) => {
  const text = messages.he
  await useSessionOf(page, person)
  await page.goto('/profile')
  const main = page.getByRole('main')
  const phone = main.getByLabel(text.ProfileForm.phone, { exact: true })

  await phone.fill('12345')
  await main.getByRole('button', { name: text.ProfileForm.save, exact: true }).click()

  await expect(main.getByText(text.ProfileErrors.phone, { exact: true })).toBeVisible()
  await expect(phone).toBeFocused()
  await expect(phone).toHaveValue('12345')
})

test('signing in opens the app in the language saved to the profile', async ({ page, context }) => {
  await setSavedLocaleOf(person, 'en')
  try {
    // From the Hebrew sign-in page, on a device with no saved choice.
    await signIn(page, person, { landing: '/en' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en')
  } finally {
    await setSavedLocaleOf(person, 'he')
  }
})
