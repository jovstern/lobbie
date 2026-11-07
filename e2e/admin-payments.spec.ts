import { addMonths, currentMonthIn, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Page } from '@playwright/test'
import { expect, notFoundStatus, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { deletePaymentsOf, setBillingStart } from './helpers/db'
import { refreshFundCache } from './helpers/fund'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const committee = 'committee1@example.com'
const resident = 'resident1@example.com'
// The seed bills every apartment ₪350 a month, and starts the e2e apartments this month.
const fee = 35_000
const currentMonth = currentMonthIn('Asia/Jerusalem')
const lastMonth = addMonths(currentMonth, -1)
const lastMonthYear = lastMonth.slice(0, 4)
const currentYear = Number(currentMonth.slice(0, 4))

// A role below the page's gets its 404; Chrome may report the document's status as an error.
test.use({ expectedConsoleErrors: [{ text: notFoundStatus, url: /\/admin\/payments$/ }] })

/** One month of one apartment on the grid: a table cell, at every width. */
function monthOnGrid(page: Page, number: string, month: string) {
  const grid = page.getByRole('region', {
    name: t('AdminPayments.gridTitle', { year: month.slice(0, 4) }),
    exact: true,
  })
  const apartment = t('AdminPayments.apartment', { number })
  const index = Number(month.slice(5)) - 1
  return grid
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: apartment, exact: true }) })
    .getByRole('cell')
    .nth(index)
}

test('the committee records a payment from the grid (overdue → paid) and voids it (overdue again)', async ({
  page,
}) => {
  const number = 'e2e-2'
  const apartment = t('AdminPayments.apartment', { number })
  const cell = () => monthOnGrid(page, number, lastMonth)
  // Billed from last month, which it has not paid: it is behind.
  await setBillingStart(number, lastMonth)
  await useSessionOf(page, committee)

  try {
    // `/admin` opens on who is behind, with the way to record a payment.
    await page.goto('/admin')
    const overviewArrears = page.getByRole('region', {
      name: text.AdminPayments.arrearsTitle,
      exact: true,
    })
    await expect(
      overviewArrears.getByRole('listitem').filter({ hasText: apartment }),
    ).toContainText(
      t.markup('StatusCard.rowOverdueAndDue', {
        part: (chunks) => chunks,
        overdue: formatAgorot(fee, 'he'),
        count: 1,
        due: formatAgorot(fee, 'he'),
      }),
    )
    await page
      .getByRole('main')
      .getByRole('link', { name: text.Admin.recordPayment, exact: true })
      .click()
    await expect(page).toHaveURL('/admin/payments')
    await expect(
      page.getByRole('heading', { level: 1, name: text.AdminPayments.title, exact: true }),
    ).toBeVisible()
    if (lastMonthYear !== String(currentYear)) {
      await page
        .getByRole('link', { name: t('AdminPayments.previousYear', { year: lastMonthYear }) })
        .click()
    }
    await expect(cell()).toContainText(text.AdminPayments.overdue)

    // From the keyboard: the apartment's link opens its payments, and focus lands on them.
    const grid = page.getByRole('region', {
      name: t('AdminPayments.gridTitle', { year: lastMonthYear }),
      exact: true,
    })
    await grid.getByRole('link', { name: apartment, exact: true }).focus()
    await page.keyboard.press('Enter')
    const opened = page.getByRole('region', { name: apartment, exact: true })
    await expect(opened.getByRole('heading', { level: 2, name: apartment })).toBeFocused()
    await expect(page).toHaveURL(/[?&]apartment=/)
    await expect(opened.getByText(text.StatusCard.overdue, { exact: true })).toBeVisible()

    const open = opened.getByRole('button', {
      name: t('PaymentForm.openLabel', { number }),
      exact: true,
    })
    await open.click()
    const dialog = page.getByRole('dialog', {
      name: t('PaymentForm.title', { number }),
      exact: true,
    })
    // What it owes so far is chosen: last month and this one.
    await expect(dialog.getByLabel(text.PaymentForm.amount, { exact: true })).toHaveValue('700')
    await dialog.getByRole('button', { name: text.PaymentForm.submit, exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(open).toBeFocused()
    await expect(opened.getByRole('status')).toHaveText(
      t('PaymentForm.recorded', { amount: formatAgorot(2 * fee, 'he'), number, count: 2 }),
    )
    await expect(opened.getByText(text.StatusCard.paid, { exact: true })).toBeVisible()
    await expect(cell()).toContainText(text.AdminPayments.paid)
    const arrears = page.getByRole('region', {
      name: text.AdminPayments.arrearsTitle,
      exact: true,
    })
    await expect(arrears.getByRole('link', { name: apartment, exact: true })).toHaveCount(0)

    const words = { month: formatMonth(lastMonth, 'he'), amount: formatAgorot(fee, 'he') }
    await opened
      .getByRole('button', { name: t('VoidPayment.openLabel', words), exact: true })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('VoidPayment.title', words),
      exact: true,
    })
    await confirm.getByLabel(text.VoidPayment.reason, { exact: true }).fill('נרשם בטעות')
    await confirm.getByRole('button', { name: text.VoidPayment.confirm, exact: true }).click()

    await expect(confirm).toBeHidden()
    // Its button is gone: focus moves to the payments' heading, and the apartment's payments
    // say what happened, where a recording is said too.
    await expect(
      opened.getByRole('heading', {
        level: 3,
        name: text.ApartmentPayments.historyTitle,
        exact: true,
      }),
    ).toBeFocused()
    await expect(opened.getByRole('status')).toHaveText(t('VoidPayment.done', words))
    await expect(opened.getByText(text.StatusCard.overdue, { exact: true })).toBeVisible()
    await expect(cell()).toContainText(text.AdminPayments.overdue)
    await expect(arrears.getByRole('listitem').filter({ hasText: apartment })).toContainText(
      t.markup('StatusCard.rowOverdue', {
        overdue: formatAgorot(fee, 'he'),
        count: 1,
        part: (chunks) => chunks,
      }),
    )
  } finally {
    await deletePaymentsOf(number)
    await setBillingStart(number, currentMonth)
    // Deleted behind the app's back: the cached fund still counts the payment. Only the admin
    // saves the building, the write that refreshes it.
    await useSessionOf(page, 'admin@example.com')
    await refreshFundCache(page)
  }
})

test('the grid moves between years in the URL, within the years it has', async ({ page }) => {
  const year = currentYear
  await useSessionOf(page, committee)
  await page.goto('/admin/payments')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('AdminPayments.gridTitle', { year: String(year) }),
      exact: true,
    }),
  ).toBeVisible()

  // A year ahead is the last: payments go at most a year ahead.
  await page
    .getByRole('link', { name: t('AdminPayments.nextYear', { year: String(year + 1) }) })
    .click()
  await expect(page).toHaveURL(`/admin/payments?year=${year + 1}`)
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('AdminPayments.gridTitle', { year: String(year + 1) }),
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: t('AdminPayments.nextYear', { year: String(year + 2) }) }),
  ).toHaveCount(0)

  // A year out of range shows the nearest one there is.
  await page.goto('/admin/payments?year=2999')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('AdminPayments.gridTitle', { year: String(year + 1) }),
      exact: true,
    }),
  ).toBeVisible()
})

test('a resident gets the 404 at /admin/payments', async ({ page }) => {
  await useSessionOf(page, resident)

  await page.goto('/admin/payments')

  await expect(
    page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
  ).toBeVisible()
})
