import { addMonths, currentMonthIn, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { demoBuildingId } from '@/scripts/demo-building'
import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import {
  apartmentIdOf,
  deletePaymentsOf,
  paymentCountOf,
  setBillingStart,
  withE2eSql,
} from './helpers/db'
import { refreshFundCache } from './helpers/fund'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
// The seed bills every apartment ₪350 a month, and starts the e2e apartments this month.
const fee = 35_000
const currentMonth = currentMonthIn('Asia/Jerusalem')
const lastMonth = addMonths(currentMonth, -1)

// Payments are recorded from the apartment's own page, which is the admin's (★). The
// committee records them too (the actions are the committee's), from the payments grid.
test('a payment turns an overdue apartment paid, and voiding it makes it overdue again', async ({
  page,
}) => {
  const number = 'e2e-2'
  const apartment = t('AdminApartments.apartmentTitle', { number })
  // Billed from last month, which it has not paid: it is behind.
  await setBillingStart(number, lastMonth)
  await useSessionOf(page, admin)

  try {
    await page.goto('/admin/apartments')
    await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
    const card = page.getByRole('region', { name: text.ApartmentPayments.title, exact: true })
    await expect(card.getByText(text.StatusCard.overdue, { exact: true })).toBeVisible()
    await expect(card).toContainText(text.ApartmentPayments.empty)

    const open = card.getByRole('button', {
      name: t('PaymentForm.openLabel', { number }),
      exact: true,
    })
    await open.click()
    const dialog = page.getByRole('dialog', {
      name: t('PaymentForm.title', { number }),
      exact: true,
    })
    // What it owes so far is chosen, and the amount is what those months owe.
    const months = dialog.getByRole('checkbox')
    await expect(months.nth(0)).toBeChecked()
    await expect(months.nth(1)).toBeChecked()
    await expect(months.nth(2)).not.toBeChecked()
    await expect(dialog.getByLabel(text.PaymentForm.amount, { exact: true })).toHaveValue('700')
    await dialog
      .getByLabel(text.PaymentForm.method, { exact: true })
      .selectOption({ label: text.PaymentMethods.bit })
    await dialog.getByRole('button', { name: text.PaymentForm.submit, exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(open).toBeFocused()
    await expect(card.getByRole('status')).toHaveText(
      t('PaymentForm.recorded', { amount: formatAgorot(2 * fee, 'he'), number, count: 2 }),
    )
    await expect(card.getByText(text.StatusCard.paid, { exact: true })).toBeVisible()
    const history = card.getByRole('region', {
      name: text.ApartmentPayments.historyTitle,
      exact: true,
    })
    // One payment per month, the newest month first.
    const rows = history.getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(formatMonth(currentMonth, 'he'))
    await expect(rows.nth(1)).toContainText(formatMonth(lastMonth, 'he'))

    const words = { month: formatMonth(lastMonth, 'he'), amount: formatAgorot(fee, 'he') }
    await history
      .getByRole('button', { name: t('VoidPayment.openLabel', words), exact: true })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('VoidPayment.title', words),
      exact: true,
    })
    const reason = confirm.getByLabel(text.VoidPayment.reason, { exact: true })
    await expect(reason).toBeFocused()
    await reason.fill('נרשם בטעות')
    await confirm.getByRole('button', { name: text.VoidPayment.confirm, exact: true }).click()

    await expect(confirm).toBeHidden()
    // Said in the apartment's payments, where a recording is said too.
    await expect(card.getByRole('status')).toHaveText(t('VoidPayment.done', words))
    // Its button is gone: focus moves to the payments' heading.
    await expect(
      history.getByRole('heading', {
        level: 3,
        name: text.ApartmentPayments.historyTitle,
        exact: true,
      }),
    ).toBeFocused()
    await expect(card.getByText(text.StatusCard.overdue, { exact: true })).toBeVisible()
    // Still listed, voided, with the reason.
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText(text.ApartmentPayments.voided)
    await expect(rows.nth(1)).toContainText('נרשם בטעות')
    await expect(
      history.getByRole('button', { name: t('VoidPayment.openLabel', words), exact: true }),
    ).toHaveCount(0)
  } finally {
    await deletePaymentsOf(number)
    await setBillingStart(number, currentMonth)
    // Deleted behind the app's back: the cached fund still counts the payment.
    await refreshFundCache(page)
  }
})

// A regression test for the row lock that keeps two recordings from paying a month twice, on
// the real database: PGlite (the unit tests') has one connection. The test plays the other
// recording in SQL, holding the apartment's lock as `payments.record` does, while the app
// records the same month.
test('a recording waits for another one of the same apartment, then refuses the paid month', async ({
  page,
}) => {
  const number = 'e2e-3'
  const apartmentId = await apartmentIdOf(number)
  await useSessionOf(page, admin)

  try {
    await page.goto(`/admin/apartments/${apartmentId}`)
    const card = page.getByRole('region', { name: text.ApartmentPayments.title, exact: true })
    await card
      .getByRole('button', { name: t('PaymentForm.openLabel', { number }), exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: t('PaymentForm.title', { number }),
      exact: true,
    })
    await expect(dialog.getByLabel(text.PaymentForm.amount, { exact: true })).toHaveValue('350')

    await withE2eSql((other) =>
      other.begin(async (tx) => {
        await tx`SELECT id FROM apartments WHERE id = ${apartmentId} FOR NO KEY UPDATE`
        const [{ pid }] = await tx`SELECT pg_backend_pid() AS pid`
        await dialog.getByRole('button', { name: text.PaymentForm.submit, exact: true }).click()

        // The app's recording now waits on this transaction's lock.
        await expect
          .poll(
            () =>
              withE2eSql(async (sql) => {
                const [row] = await sql`
                  SELECT count(*)::int AS blocked FROM pg_stat_activity
                  WHERE pg_blocking_pids(pid) @> ARRAY[${Number(pid)}::int]`
                return Number(row.blocked)
              }),
            { timeout: 15_000 },
          )
          .toBeGreaterThan(0)

        // The other recording pays the month and commits.
        await tx`
          INSERT INTO payments
            (building_id, apartment_id, month, amount_agorot, paid_on, method, recorded_by)
          SELECT ${demoBuildingId}, ${apartmentId}, ${currentMonth}, ${fee}, current_date,
            'cash', id
          FROM "user" WHERE email = 'committee2@example.com'`
      }),
    )

    // Once the lock is free, the app sees the month paid and records nothing.
    await expect(dialog).toContainText(
      t('PaymentErrors.paid', { month: formatMonth(currentMonth, 'he') }),
    )
    expect(await paymentCountOf(number, currentMonth)).toBe(1)
  } finally {
    await deletePaymentsOf(number)
    // The other recording and its removal were behind the app's back: the cached fund missed both.
    await refreshFundCache(page)
  }
})
