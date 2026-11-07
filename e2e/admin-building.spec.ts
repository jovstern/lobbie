import { formatAgorot } from '@/app/lib/utils/money'
import { expect, notFoundStatus, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages } from './helpers/copy'
import { deleteAdjustmentsWithReason, demoBuildingBalanceAgorot } from './helpers/db'
import { refreshFundCache } from './helpers/fund'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const admin = 'admin@example.com'
const committee = 'committee1@example.com'
const resident = 'resident1@example.com'

// A role below the page's gets its 404; Chrome may report the document's status as an error.
test.use({ expectedConsoleErrors: [{ text: notFoundStatus, url: /\/admin(\/building)?$/ }] })

test('the admin changes the quorum and sees it saved', async ({ page }) => {
  await useSessionOf(page, admin)
  await page.goto('/admin/building')

  const quorum = page.getByLabel(text.BuildingForm.quorumPercent, { exact: true })
  const save = page.getByRole('button', { name: text.BuildingForm.save, exact: true })
  const original = await quorum.inputValue()
  const changed = original === '67' ? '66' : '67'

  try {
    await quorum.fill(changed)
    await save.click()
    await expect(page.getByText(text.BuildingForm.saved, { exact: true })).toBeVisible()

    await page.reload()
    await expect(quorum).toHaveValue(changed)
  } finally {
    // Leave the building as the seed made it.
    await quorum.fill(original)
    await save.click()
    await expect(page.getByText(text.BuildingForm.saved, { exact: true })).toBeVisible()
  }
})

test('a negative adjustment lowers the fund on Home by its amount', async ({ page }) => {
  const before = await demoBuildingBalanceAgorot()
  // Unique per run and project, so this test finds, and then removes, its own row.
  const reason = `עמלות בנק ${Date.now()}`
  await useSessionOf(page, admin)
  await page.goto('/admin/building')
  const fund = page.getByRole('region', { name: text.AdminBuilding.fundTitle, exact: true })

  try {
    const open = fund.getByRole('button', { name: text.AdjustmentForm.open, exact: true })
    await open.click()
    const dialog = page.getByRole('dialog', { name: text.AdjustmentForm.title, exact: true })
    await dialog.getByLabel(text.AdjustmentForm.out, { exact: true }).check()
    await dialog.getByLabel(text.AdjustmentForm.amount, { exact: true }).fill('123.45')
    await dialog.getByLabel(text.AdjustmentForm.reason, { exact: true }).fill(reason)
    await dialog.getByRole('button', { name: text.AdjustmentForm.submit, exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(fund.getByRole('status')).toHaveText(text.AdjustmentForm.added)
    await expect(open).toBeFocused()
    const row = fund.getByRole('listitem').filter({ hasText: reason })
    await expect(row).toContainText(formatAgorot(-12_345, 'he', { signed: true }))

    await page.goto('/')
    await expect(
      page.getByRole('region', { name: text.BalanceCard.title, exact: true }),
    ).toContainText(formatAgorot(before - 12_345, 'he'))
  } finally {
    await deleteAdjustmentsWithReason(reason)
    // The delete happened behind the app, whose balance is cached: other specs must read the
    // seeded fund again.
    await refreshFundCache(page)
  }
})

test('a resident gets the 404 at /admin and /admin/building', async ({ page }) => {
  await useSessionOf(page, resident)

  for (const path of ['/admin', '/admin/building']) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
    ).toBeVisible()
  }
})

test('a committee member opens /admin but gets the 404 at /admin/building', async ({ page }) => {
  await useSessionOf(page, committee)

  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { level: 1, name: text.Admin.title, exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: text.Admin.buildingLink, exact: true })).toHaveCount(
    0,
  )

  await page.goto('/admin/building')
  await expect(
    page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
  ).toBeVisible()
})

test('the admin reaches the admin section from the navigation', async ({ page, isMobile }) => {
  await useSessionOf(page, admin)

  if (isMobile) {
    // On phones it is a row of More, not a sixth tab.
    await page.goto('/more')
    await page.getByRole('main').getByRole('link', { name: text.More.admin, exact: true }).click()
  } else {
    await page.goto('/')
    await page
      .getByTestId('side-nav')
      .getByRole('link', { name: text.Nav.admin, exact: true })
      .click()
  }
  await expect(page).toHaveURL('/admin')

  await page
    .getByRole('main')
    .getByRole('link', { name: text.Admin.buildingLink, exact: true })
    .click()
  await expect(page).toHaveURL('/admin/building')
  await expect(
    page.getByRole('heading', { level: 1, name: text.AdminBuilding.title, exact: true }),
  ).toBeVisible()
})
