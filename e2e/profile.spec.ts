import { expect, test } from './fixtures'
import { signIn } from './helpers/auth'
import { messages } from './helpers/copy'
import { addResident, deleteUser, savedLocaleOf, setSavedLocaleOf } from './helpers/db'

/**
 * Someone new for each test and project, living in e2e-2: the language saved to their profile
 * changes no one else's test, and each address signs in once per run (see helpers/auth.ts).
 */
async function newPerson(slug: string, project: string) {
  const email = `profile-${slug}-${project}@example.com`
  await addResident(email, `פרופיל ${slug} ${project}`, 'e2e-2')
  return email
}

test('choosing English on the profile opens it in English, and the choice persists', async ({
  page,
  context,
}, testInfo) => {
  const person = await newPerson('language', testInfo.project.name)
  try {
    await signIn(page, person)
    await page.goto('/profile')
    const choice = (name: string) =>
      page.getByRole('main').getByRole('button', { name, exact: true })
    await expect(choice(messages.he.LanguageChoice.he)).toHaveAttribute('aria-pressed', 'true')

    await choice(messages.he.LanguageChoice.en).click()

    // Back at the language section, in English, with focus on the choice, which says it saved.
    await expect(page).toHaveURL('/en/profile#language')
    await expect(choice(messages.en.LanguageChoice.en)).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(choice(messages.en.LanguageChoice.en)).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('main').getByText(messages.en.Common.saved, { exact: true }),
    ).toBeVisible()
    expect(await savedLocaleOf(person)).toBe('en')
    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en')

    // The cookie sends an unprefixed address to English.
    await page.goto('/')
    await expect(page).toHaveURL('/en')

    // And back to Hebrew, from the keyboard: an arrow key changes nothing, Enter does.
    await page.goto('/en/profile')
    await choice(messages.en.LanguageChoice.en).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await choice(messages.en.LanguageChoice.he).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/profile#language')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    expect(await savedLocaleOf(person)).toBe('he')
  } finally {
    await deleteUser(person)
  }
})

test('a wrong phone is explained, focused and kept', async ({ page }, testInfo) => {
  const text = messages.he
  const person = await newPerson('phone', testInfo.project.name)
  try {
    await signIn(page, person)
    await page.goto('/profile')
    const main = page.getByRole('main')
    const phone = main.getByLabel(text.ProfileForm.phone, { exact: true })

    await phone.fill('12345')
    await main.getByRole('button', { name: text.ProfileForm.save, exact: true }).click()

    await expect(main.getByText(text.ProfileErrors.phone, { exact: true })).toBeVisible()
    await expect(phone).toBeFocused()
    await expect(phone).toHaveValue('12345')
  } finally {
    await deleteUser(person)
  }
})

test('signing in opens the app in the language saved to the profile', async ({
  page,
  context,
}, testInfo) => {
  const person = await newPerson('saved', testInfo.project.name)
  try {
    await setSavedLocaleOf(person, 'en')
    // From the Hebrew sign-in page, on a device with no saved choice.
    await signIn(page, person, { landing: '/en' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en')
  } finally {
    await deleteUser(person)
  }
})
