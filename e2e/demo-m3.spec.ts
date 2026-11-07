import { addMonths, currentMonthIn, formatDay, todayIn } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import {
  deletePaymentsOf,
  demoBuildingBalanceAgorot,
  expenseCounts,
  receiptKeyOf,
  setBillingStart,
  voidExpenseInDb,
} from './helpers/db'
import { refreshFundCache } from './helpers/fund'
import { removeUpload } from './helpers/uploads'

// The M3 demo flow (plan, M3): the committee records a payment for an apartment that is behind
// (it turns paid), adds an expense with a receipt (the fund drops), and the apartment's resident
// sees the payment on their Money page. The pauses let a viewer of the recorded GIF follow it.
const text = messages.he
const t = translator('he')
const committee = 'committee1@example.com'
const admin = 'admin@example.com'
const number = 'e2e-2'
const resident = 'e2e2@example.com'
const fee = 35_000
const currentMonth = currentMonthIn('Asia/Jerusalem')
const lastMonth = addMonths(currentMonth, -1)
const today = todayIn('Asia/Jerusalem')
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')

// Everyone signs in before the recording starts, in a context that is not recorded: the
// recorded page then reuses the saved sessions, so no sign-in shows in the GIF.
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await useSessionOf(page, committee)
  await context.clearCookies()
  await useSessionOf(page, resident)
  await context.clearCookies()
  await useSessionOf(page, admin)
  await context.close()
})

test('M3 demo: record a payment, add an expense with a receipt, the resident sees it', async ({
  page,
  browser,
}, testInfo) => {
  // The pauses take longer than a test's usual 30 s.
  test.setTimeout(120_000)
  const apartment = t('AdminPayments.apartment', { number })
  // One per project: both run against the same test branch, one after the other.
  const description = testInfo.project.name === 'phone' ? 'תיקון האינטרקום' : 'תיקון דלת הלובי'
  const amount = formatAgorot(48_000, 'he')
  // Billed from last month, which it has not paid: it is behind.
  await setBillingStart(number, lastMonth)
  const before = await demoBuildingBalanceAgorot()
  await useSessionOf(page, committee)

  try {
    await page.goto('/admin/payments')
    if (lastMonth.slice(0, 4) !== currentMonth.slice(0, 4)) {
      await page
        .getByRole('link', {
          name: t('AdminPayments.previousYear', { year: lastMonth.slice(0, 4) }),
        })
        .click()
    }
    const grid = page.getByRole('region', {
      name: t('AdminPayments.gridTitle', { year: lastMonth.slice(0, 4) }),
      exact: true,
    })
    await page.waitForTimeout(1500)
    await grid.getByRole('link', { name: apartment, exact: true }).click()
    const opened = page.getByRole('region', { name: apartment, exact: true })
    await expect(opened.getByText(text.StatusCard.overdue, { exact: true })).toBeVisible()
    await page.waitForTimeout(1000)

    await opened
      .getByRole('button', { name: t('PaymentForm.openLabel', { number }), exact: true })
      .click()
    const dialog = page.getByRole('dialog', { name: t('PaymentForm.title', { number }) })
    await expect(dialog.getByLabel(text.PaymentForm.amount, { exact: true })).toHaveValue('700')
    await dialog
      .getByLabel(text.PaymentForm.method, { exact: true })
      .selectOption({ label: text.PaymentMethods.bit })
    await page.waitForTimeout(1000)
    await dialog.getByRole('button', { name: text.PaymentForm.submit, exact: true }).click()
    await expect(opened.getByText(text.StatusCard.paid, { exact: true })).toBeVisible()
    await page.waitForTimeout(2000)

    await page.goto('/admin/expenses')
    const form = page.getByRole('region', { name: text.AdminExpenses.formTitle, exact: true })
    await form.getByLabel(text.ExpenseForm.category, { exact: true }).selectOption('repairs')
    await form.getByLabel(text.ExpenseForm.amount, { exact: true }).fill('480')
    await form.getByLabel(text.ExpenseForm.description, { exact: true }).fill(description)
    await form
      .getByLabel(text.ExpenseForm.receipt, { exact: true })
      .setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: pdf })
    await page.waitForTimeout(1000)
    await form.getByRole('button', { name: text.ExpenseForm.submit, exact: true }).click()
    await expect(
      page.getByText(t('ExpenseForm.recorded', { description, amount }), { exact: true }),
    ).toBeVisible()
    await page.waitForTimeout(1500)

    // The fund counts the payment in and the expense out.
    await page.goto('/money/balance')
    await expect(
      page.getByRole('region', { name: text.Balance.nowTitle, exact: true }),
    ).toContainText(formatAgorot(before + 2 * fee - 48_000, 'he'))
    await expect(
      page.getByRole('link', {
        name: t('Balance.receiptLabel', { description, date: formatDay(today, 'he') }),
        exact: true,
      }),
    ).toBeVisible()
    await page.waitForTimeout(2500)

    // The apartment's resident sees the payment on their Money page.
    await useSessionOf(page, resident)
    await page.goto('/money')
    const history = page.getByRole('region', { name: text.Money.historyTitle, exact: true })
    await expect(history).toContainText(formatAgorot(fee, 'he'))
    await history.scrollIntoViewIfNeeded()
    await page.waitForTimeout(3000)
  } finally {
    if (await expenseCounts(description)) await voidExpenseInDb(description)
    const key = await receiptKeyOf(description)
    if (key) await removeUpload(key)
    await deletePaymentsOf(number)
    await setBillingStart(number, currentMonth)
    // Removed behind the app's back: the cached fund still counts both. Off camera, so the
    // recording ends on the resident's page.
    const offCamera = await (await browser.newContext()).newPage()
    await useSessionOf(offCamera, admin)
    await refreshFundCache(offCamera)
    await offCamera.context().close()
  }
})
