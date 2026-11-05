import { expect, notFoundStatus, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { apartmentIdOf, deleteApartmentNumbered, residentCountOf } from './helpers/db'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
const committee = 'committee1@example.com'
const added = 'e2e-t2'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A role below the page's gets its 404; Chrome may report the document's status as an error.
test.use({
  expectedConsoleErrors: [{ text: notFoundStatus, url: /\/admin\/apartments(\/[^/]+)?$/ }],
})

test('the admin adds an apartment, changes its floor and removes it', async ({ page }) => {
  await useSessionOf(page, admin)
  await page.goto('/admin/apartments')
  const main = page.getByRole('main')
  const status = main.getByRole('status')

  try {
    await main.getByRole('button', { name: text.ApartmentForm.open, exact: true }).click()
    const addDialog = page.getByRole('dialog', { name: text.ApartmentForm.addTitle, exact: true })
    await addDialog.getByLabel(text.ApartmentForm.number, { exact: true }).fill(added)
    await addDialog.getByLabel(text.ApartmentForm.floor, { exact: true }).fill('4')
    await addDialog.getByRole('button', { name: text.ApartmentForm.add, exact: true }).click()

    await expect(addDialog).toBeHidden()
    await expect(status).toHaveText(t('ApartmentForm.added', { number: added }))
    const link = main.getByRole('link', {
      name: t('AdminApartments.apartmentTitle', { number: added }),
      exact: true,
    })
    await expect(link).toBeVisible()

    await main
      .getByRole('button', { name: t('ApartmentForm.editLabel', { number: added }), exact: true })
      .click()
    const editTitle = t('ApartmentForm.editTitle', { number: added })
    const editDialog = page.getByRole('dialog', { name: editTitle, exact: true })
    const floor = editDialog.getByLabel(text.ApartmentForm.floor, { exact: true })
    await expect(floor).toHaveValue('4')
    await floor.fill('5')
    await editDialog.getByRole('button', { name: text.ApartmentForm.save, exact: true }).click()
    await expect(editDialog).toBeHidden()
    await expect(status).toHaveText(t('ApartmentForm.saved', { number: added }))

    await link.click()
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('AdminApartments.apartmentTitle', { number: added }),
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole('main')).toContainText(
      t('AdminApartments.floorValue', { floor: 5 }),
    )
    await page.getByRole('link', { name: text.AdminApartments.back, exact: true }).click()
    await expect(page).toHaveURL('/admin/apartments')

    await main
      .getByRole('button', {
        name: t('ApartmentRemove.removeLabel', { number: added }),
        exact: true,
      })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('ApartmentRemove.title', { number: added }),
      exact: true,
    })
    await confirm.getByRole('button', { name: text.ApartmentRemove.confirm, exact: true }).click()

    await expect(confirm).toBeHidden()
    await expect(status).toHaveText(t('ApartmentRemove.removed', { number: added }))
    await expect(link).toHaveCount(0)
    await expect(
      main.getByRole('heading', { level: 1, name: text.AdminApartments.title, exact: true }),
    ).toBeFocused()
  } finally {
    await deleteApartmentNumbered(added)
  }
})

test('a number the building already has is a field error', async ({ page }) => {
  await useSessionOf(page, admin)
  await page.goto('/admin/apartments')

  await page
    .getByRole('main')
    .getByRole('button', { name: text.ApartmentForm.open, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: text.ApartmentForm.addTitle, exact: true })
  const number = dialog.getByLabel(text.ApartmentForm.number, { exact: true })
  await number.fill('1')
  await dialog.getByLabel(text.ApartmentForm.floor, { exact: true }).fill('1')
  await dialog.getByRole('button', { name: text.ApartmentForm.add, exact: true }).click()

  // Refused by the database, so nothing was added and there is nothing to clean up.
  await expect(
    dialog.getByText(t('ApartmentErrors.duplicate', { number: '1' }), { exact: true }),
  ).toBeVisible()
  await expect(number).toBeFocused()
  await expect(number).toHaveValue('1')
  await expect(number).toHaveAttribute('aria-invalid', 'true')
})

test('removing an apartment people live in is blocked, and says why', async ({ page }) => {
  const residents = await residentCountOf('1')
  expect(residents).toBeGreaterThan(0)
  await useSessionOf(page, admin)
  await page.goto('/admin/apartments')

  const remove = page
    .getByRole('main')
    .getByRole('button', { name: t('ApartmentRemove.removeLabel', { number: '1' }), exact: true })
  const reason = t('ApartmentBlockers.residents', { count: residents })

  await expect(remove).toHaveAttribute('aria-disabled', 'true')
  await expect(remove).toHaveAccessibleDescription(new RegExp(escapeRegExp(reason)))
  await expect(page.getByRole('main').getByText(reason)).toBeVisible()

  await remove.click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})

test('a committee member gets the 404 at the apartments pages', async ({ page }) => {
  const apartmentId = await apartmentIdOf('1')
  await useSessionOf(page, committee)

  await page.goto('/admin')
  await expect(
    page.getByRole('main').getByRole('link', { name: text.Admin.apartmentsLink, exact: true }),
  ).toHaveCount(0)

  for (const path of ['/admin/apartments', `/admin/apartments/${apartmentId}`]) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
    ).toBeVisible()
  }
})
