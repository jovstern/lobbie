import { formatDay, todayIn } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Page } from '@playwright/test'
import { expect, notFoundStatus, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import {
  demoBuildingBalanceAgorot,
  expenseCounts,
  receiptKeyOf,
  voidExpenseInDb,
} from './helpers/db'
import { removeUpload } from './helpers/uploads'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const committee = 'committee1@example.com'
const resident = 'resident1@example.com'
const today = todayIn('Asia/Jerusalem')
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')

// A role below the page's gets its 404; Chrome may report the document's status as an error.
test.use({ expectedConsoleErrors: [{ text: notFoundStatus, url: /\/admin\/expenses$/ }] })

async function fillExpense(page: Page, description: string, amount: string) {
  const form = page.getByRole('region', { name: text.AdminExpenses.formTitle, exact: true })
  await form.getByLabel(text.ExpenseForm.category, { exact: true }).selectOption('repairs')
  await form.getByLabel(text.ExpenseForm.amount, { exact: true }).fill(amount)
  await form.getByLabel(text.ExpenseForm.description, { exact: true }).fill(description)
  return form
}

/** The fund on Home, once its card has streamed in. */
async function expectFundOnHome(page: Page, agorot: number) {
  await page.goto('/')
  await expect(
    page.getByRole('region', { name: text.BalanceCard.title, exact: true }),
  ).toContainText(formatAgorot(agorot, 'he'))
}

/** Voids today's expense through the app, from `/admin/expenses`, as the signed-in committee. */
async function voidThroughApp(page: Page, description: string, amount: string) {
  await page.goto('/admin/expenses')
  await page
    .getByRole('button', {
      name: t('VoidExpense.openLabel', { description, date: formatDay(today, 'he'), amount }),
      exact: true,
    })
    .click()
  const confirm = page.getByRole('alertdialog', {
    name: t('VoidExpense.title', { description }),
    exact: true,
  })
  await confirm.getByLabel(text.VoidExpense.reason, { exact: true }).fill('נרשמה לבדיקה')
  await confirm.getByRole('button', { name: text.VoidExpense.confirm, exact: true }).click()
  await expect(confirm).toBeHidden()
}

/**
 * After a failure before the test's own void, the expense would keep counting in later specs'
 * fund checks. It is voided through the app (the page still has the committee's session), which
 * also refreshes the cached fund. If even that fails, it is voided in the database, and true
 * says the cached fund must still be refreshed by an app write.
 */
async function voidIfStillCounted(page: Page, description: string, amount: string) {
  if (!(await expenseCounts(description))) return false
  try {
    await voidThroughApp(page, description, amount)
    if (!(await expenseCounts(description))) return false
  } catch {
    // Falls through to the database.
  }
  await voidExpenseInDb(description)
  return true
}

/** The admin saves the building details unchanged: a write that updates the building's tag. */
async function refreshFundCache(page: Page) {
  await page.goto('/admin/building')
  await page.getByRole('button', { name: text.BuildingForm.save, exact: true }).click()
  await expect(page.getByText(text.BuildingForm.saved, { exact: true })).toBeVisible()
}

test('the committee adds an expense with a receipt: the fund drops, the receipt opens, and voiding it gives the money back', async ({
  page,
  request,
}, testInfo) => {
  // Unique per run and project, so this test finds its own expense.
  const description = `החלפת מנעול ${testInfo.project.name} ${Date.now()}`
  const amount = formatAgorot(12_345, 'he')
  const before = await demoBuildingBalanceAgorot()
  await useSessionOf(page, committee)
  await page.goto('/admin/expenses')

  try {
    const form = await fillExpense(page, description, '123.45')
    await form
      .getByLabel(text.ExpenseForm.receipt, { exact: true })
      .setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: pdf })
    await form.getByRole('button', { name: text.ExpenseForm.submit, exact: true }).click()

    await expect(
      page.getByText(t('ExpenseForm.recorded', { description, amount }), { exact: true }),
    ).toBeVisible()
    // The form empties for the next one.
    await expect(form.getByLabel(text.ExpenseForm.description, { exact: true })).toHaveValue('')

    // The receipt opens from the list: a PDF downloads, under the expense's date.
    const receipt = page.getByRole('link', {
      name: t('AdminExpenses.receiptLabel', { description, date: formatDay(today, 'he') }),
      exact: true,
    })
    const download = page.waitForEvent('download')
    await receipt.click()
    expect((await download).suggestedFilename()).toBe(`receipt-${today}.pdf`)

    const href = await receipt.getAttribute('href')
    if (href === null) throw new Error('the receipt link has no href')
    const served = await page.request.get(href)
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toBe('application/pdf')
    expect(served.headers()['x-content-type-options']).toBe('nosniff')
    expect(served.headers()['cache-control']).toBe('private, no-store')
    expect(await served.body()).toEqual(pdf)
    // Someone signed out gets nothing (another building's member: the route's unit test).
    expect((await request.get(href)).status()).toBe(404)

    // The fund drops by the expense.
    await expectFundOnHome(page, before - 12_345)

    // Voiding it gives the money back; it stays listed as voided.
    await voidThroughApp(page, description, amount)
    await expect(
      page.getByText(t('VoidExpense.done', { description, amount }), { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: text.AdminExpenses.title, exact: true }),
    ).toBeFocused()
    await expectFundOnHome(page, before)
  } finally {
    // The row stays in the test branch (reset every run), voided, so later fund checks are
    // right; its file goes.
    if (await voidIfStillCounted(page, description, amount)) {
      // Voided behind the app's back: the cached fund still counts it.
      await useSessionOf(page, 'admin@example.com')
      await refreshFundCache(page)
    }
    const key = await receiptKeyOf(description)
    if (key) await removeUpload(key)
  }
})

test('a file that only claims to be a PDF is refused, and nothing is added', async ({
  page,
}, testInfo) => {
  const description = `קובץ מוסווה ${testInfo.project.name} ${Date.now()}`
  await useSessionOf(page, committee)
  await page.goto('/admin/expenses')

  const form = await fillExpense(page, description, '10')
  await form.getByLabel(text.ExpenseForm.receipt, { exact: true }).setInputFiles({
    name: 'receipt.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
  })
  await form.getByRole('button', { name: text.ExpenseForm.submit, exact: true }).click()

  await expect(form.getByText(text.ExpenseErrors.receiptType, { exact: true })).toBeVisible()
  // What was typed stays.
  await expect(form.getByLabel(text.ExpenseForm.description, { exact: true })).toHaveValue(
    description,
  )
  expect(await receiptKeyOf(description)).toBeNull()
  await expect(page.getByRole('main').getByText(description, { exact: true })).toHaveCount(0)
})

test('a resident gets the 404 at /admin/expenses', async ({ page }) => {
  await useSessionOf(page, resident)
  await page.goto('/admin/expenses')
  await expect(
    page.getByRole('heading', { level: 1, name: text.NotFound.title, exact: true }),
  ).toBeVisible()
})
