import { addMonths, currentMonthIn, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { expect, notFoundStatus, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { addOwnFee, buildingFeeCountFrom, deleteFeesOf } from './helpers/db'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
const committee = 'committee1@example.com'
const resident = 'resident1@example.com'

// The seed is relative to today, in the building's time zone.
const currentMonth = currentMonthIn('Asia/Jerusalem')
// Writes go to the e2e apartments' own fees, from the last month a fee may start (a year
// ahead). The app caches the building's rates until a fee write refreshes them, and the
// cleanup deletes behind its back, so a deleted rate may linger in that cache: starting this
// far ahead, it changes no amount any spec reads, all of which are for this month or earlier.
const farMonth = addMonths(currentMonth, 12)

// A role below the page's gets its 404; Chrome may report the document's status as an error.
test.use({ expectedConsoleErrors: [{ text: notFoundStatus, url: /\/admin\/fees$/ }] })

test("the committee sets an apartment's own fee from the fees page, and its history shows it", async ({
  page,
}) => {
  const number = 'e2e-2'
  await useSessionOf(page, committee)
  await page.goto('/admin')
  // The overview's card links to it, and so does the admin navigation the committee now has.
  await expect(
    page.getByRole('link', { name: text.Admin.feesLink, description: text.Admin.feesLinkBody }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: text.Admin.navLabel, exact: true })
    .getByRole('link', { name: text.Admin.fees, exact: true })
    .click()
  await expect(page).toHaveURL('/admin/fees')
  await expect(
    page.getByRole('heading', { level: 1, name: text.AdminFees.title, exact: true }),
  ).toBeVisible()
  const card = page.getByRole('region', { name: text.AdminFees.apartmentsTitle, exact: true })

  try {
    const open = card.getByRole('button', { name: text.FeeForm.openApartment, exact: true })
    await open.click()
    const dialog = page.getByRole('dialog', { name: text.FeeForm.apartmentTitle, exact: true })
    await dialog
      .getByLabel(text.FeeForm.apartment, { exact: true })
      .selectOption({ label: t('FeeForm.apartmentNumber', { number }) })
    await dialog.getByLabel(text.FeeForm.amount, { exact: true }).fill('412.50')
    await dialog.getByLabel(text.FeeForm.effectiveFrom, { exact: true }).fill(farMonth)
    await dialog.getByRole('button', { name: text.FeeForm.submit, exact: true }).click()

    await expect(dialog).toBeHidden()
    const amount = formatAgorot(41_250, 'he')
    const month = formatMonth(farMonth, 'he')
    await expect(card.getByRole('status')).toHaveText(
      t('FeeForm.savedApartment', { number, amount, month }),
    )
    await expect(open).toBeFocused()
    const apartment = card.getByRole('region', {
      name: t('AdminFees.apartment', { number }),
      exact: true,
    })
    await expect(apartment).toContainText(t('AdminFees.fromMonth', { month }))
    await expect(apartment).toContainText(text.AdminFees.stateUpcoming)
    await expect(apartment).toContainText(amount)
    // The apartment pages are the admin's: the committee sees its name, not a link.
    await expect(apartment.getByRole('link')).toHaveCount(0)
  } finally {
    await deleteFeesOf(number)
  }
})

test('a month that has passed is refused once there is a fee: earlier months keep theirs', async ({
  page,
}) => {
  // The building's own fee, which the seed set: the rule needs a target that already has a
  // fee, and a refused attempt writes nothing, so no e2e apartment is needed here.
  const lastMonth = addMonths(currentMonth, -1)
  await useSessionOf(page, committee)
  await page.goto('/admin/fees')
  const card = page.getByRole('region', { name: text.AdminFees.buildingTitle, exact: true })

  await card.getByRole('button', { name: text.FeeForm.openBuilding, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: text.FeeForm.buildingTitle, exact: true })
  await dialog.getByLabel(text.FeeForm.amount, { exact: true }).fill('400')
  const monthField = dialog.getByLabel(text.FeeForm.effectiveFrom, { exact: true })
  await expect(monthField).toHaveAttribute('min', currentMonth)
  await monthField.fill(lastMonth)
  await dialog.getByRole('button', { name: text.FeeForm.submit, exact: true }).click()

  await expect(dialog).toContainText(
    t('FeeErrors.beforeCurrentMonth', { month: formatMonth(currentMonth, 'he') }),
  )
  await expect(monthField).toBeFocused()
  await expect(monthField).toHaveValue(lastMonth)
  expect(await buildingFeeCountFrom(lastMonth)).toBe(0)
})

test("the admin sets an apartment's own fee on its page, and the fees page lists it", async ({
  page,
}) => {
  const number = 'e2e-1'
  const apartment = t('AdminApartments.apartmentTitle', { number })
  await useSessionOf(page, admin)
  await page.goto('/admin/apartments')
  await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
  const card = page.getByRole('region', { name: text.ApartmentFee.title, exact: true })
  await expect(card).toContainText(text.ApartmentFee.noOwnFees)

  try {
    await card.getByRole('button', { name: text.FeeForm.openThisApartment, exact: true }).click()
    const dialog = page.getByRole('dialog', {
      name: t('FeeForm.apartmentTitleNumbered', { number }),
      exact: true,
    })
    const monthField = dialog.getByLabel(text.FeeForm.effectiveFrom, { exact: true })
    // Next month is the form's own choice.
    await expect(monthField).toHaveValue(addMonths(currentMonth, 1))
    await dialog.getByLabel(text.FeeForm.amount, { exact: true }).fill('420')
    await monthField.fill(farMonth)
    await dialog.getByRole('button', { name: text.FeeForm.submit, exact: true }).click()

    await expect(dialog).toBeHidden()
    const amount = formatAgorot(42_000, 'he')
    await expect(card.getByRole('status')).toHaveText(
      t('FeeForm.savedApartment', { number, amount, month: formatMonth(farMonth, 'he') }),
    )
    // This month it still pays the building's fee; its own starts later.
    await expect(card.getByText(text.ApartmentFee.building, { exact: true })).toBeVisible()
    const own = card.getByRole('region', { name: text.ApartmentFee.historyTitle, exact: true })
    await expect(own).toContainText(amount)
    await expect(own).toContainText(text.AdminFees.stateUpcoming)

    await page.goto('/admin/fees')
    const row = page
      .getByRole('region', { name: text.AdminFees.apartmentsTitle, exact: true })
      .getByRole('region', { name: t('AdminFees.apartment', { number }), exact: true })
    await expect(row).toContainText(amount)
    await row.getByRole('link', { name: t('AdminFees.apartment', { number }), exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: apartment, exact: true }),
    ).toBeVisible()
  } finally {
    await deleteFeesOf(number)
  }
})

test("ending an apartment's own fee: it follows the building from next month, its history kept", async ({
  page,
}) => {
  const number = 'e2e-3'
  const apartment = t('AdminApartments.apartmentTitle', { number })
  const nextMonth = formatMonth(addMonths(currentMonth, 1), 'he')
  // Its own fee in force this month, at the building's own ₪350: the follow-building write
  // refreshes the app's cached rates and the cleanup then deletes behind its back, so any
  // rate left in that cache bills exactly what the building's fee does.
  await addOwnFee(number, 35_000, currentMonth)
  await useSessionOf(page, admin)

  try {
    await page.goto('/admin/apartments')
    await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
    const card = page.getByRole('region', { name: text.ApartmentFee.title, exact: true })
    await expect(card.getByText(text.ApartmentFee.own, { exact: true })).toBeVisible()

    await card
      .getByRole('button', { name: t('FollowBuilding.openLabel', { number }), exact: true })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('FollowBuilding.title', { number, month: nextMonth }),
      exact: true,
    })
    await confirm.getByRole('button', { name: text.FollowBuilding.confirm, exact: true }).click()

    await expect(confirm).toBeHidden()
    await expect(page.getByRole('main').getByRole('status').first()).toHaveText(
      t('FollowBuilding.done', { number, month: nextMonth }),
    )
    // The button is gone: focus moves to the heading.
    await expect(
      page.getByRole('heading', { level: 1, name: apartment, exact: true }),
    ).toBeFocused()
    await expect(
      card.getByRole('button', { name: t('FollowBuilding.openLabel', { number }), exact: true }),
    ).toHaveCount(0)
    // This month still its own; from next month the building's, with both rows in the history.
    const own = card.getByRole('region', { name: text.ApartmentFee.historyTitle, exact: true })
    const rows = own.getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(t('AdminFees.followsFrom', { month: nextMonth }))
    await expect(rows.first()).toContainText(text.AdminFees.stateUpcoming)
    await expect(rows.nth(1)).toContainText(formatAgorot(35_000, 'he'))
    await expect(rows.nth(1)).toContainText(text.AdminFees.stateCurrent)

    await page.goto('/admin/fees')
    await expect(
      page
        .getByRole('region', { name: t('AdminFees.apartment', { number }), exact: true })
        .getByRole('listitem')
        .first(),
    ).toContainText(t('AdminFees.followsFrom', { month: nextMonth }))
  } finally {
    await deleteFeesOf(number)
  }
})

test('a resident gets the 404 at /admin/fees', async ({ page }) => {
  await useSessionOf(page, resident)

  await page.goto('/admin/fees')

  await expect(
    page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
  ).toBeVisible()
})
