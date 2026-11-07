import { addMonths, currentMonthIn, formatDay, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Page } from '@playwright/test'
import { expect, notFoundStatus, test } from './fixtures'
import { localePrefix, useSessionOf } from './helpers/auth'
import { messages, translator, type Locale } from './helpers/copy'
import {
  addPayment,
  addResidence,
  apartmentIdOf,
  deletePaymentsOf,
  demoBuildingBalanceAgorot,
  demoExpensesByCategory,
  removeResidence,
  setBillingStart,
} from './helpers/db'
import { refreshFundCache } from './helpers/fund'

// The e2e suite's own resident and apartment: the payments are written here and removed after.
const resident = 'e2e3@example.com'
const number = 'e2e-3'
// The seed bills every apartment ₪350 a month, and starts the e2e apartments this month.
const fee = 35_000
const currentMonth = currentMonthIn('Asia/Jerusalem')
const lastMonth = addMonths(currentMonth, -1)
// Both dates are today or earlier, whatever day the suite runs.
const lastMonthPaidOn = `${lastMonth}-05`
const voidedPaidOn = `${currentMonth}-01`
const voidReason = 'נרשם פעמיים בטעות'
// The treasurer who records the seed's payments: a resident never sees who did.
const treasurer = 'רונית ביטון'

// Someone else's apartment is a 404; Chrome may report the document's status as an error.
test.use({ expectedConsoleErrors: [{ text: notFoundStatus, url: /\/money\?apartment=/ }] })

/** The history's payments: table rows on desktop, list items on a phone. */
function historyRows(page: Page, locale: Locale, isPhone: boolean) {
  const history = page.getByRole('region', {
    name: messages[locale].Money.historyTitle,
    exact: true,
  })
  return isPhone
    ? history.getByRole('listitem')
    : history.getByRole('row').filter({ has: page.getByRole('rowheader') })
}

for (const locale of ['he', 'en'] as const) {
  const text = messages[locale]
  const t = translator(locale)

  test(`a resident sees their apartment's months and payment history, in ${locale}`, async ({
    page,
  }, testInfo) => {
    const isPhone = testInfo.project.name === 'phone'
    // Billed from last month, which is paid; this month's payment was voided, so it is due.
    await setBillingStart(number, lastMonth)
    await addPayment(number, {
      month: lastMonth,
      amountAgorot: fee,
      paidOn: lastMonthPaidOn,
      method: 'transfer',
    })
    await addPayment(number, {
      month: currentMonth,
      amountAgorot: fee,
      paidOn: voidedPaidOn,
      method: 'cash',
      voidReason,
    })
    await useSessionOf(page, resident)

    try {
      await page.goto(`${localePrefix(locale)}/money`)
      await expect(
        page.getByRole('heading', { level: 1, name: text.Money.title, exact: true }),
      ).toBeVisible()

      // How it stands now: this month is due, in full.
      const standing = page.getByRole('region', {
        name: t('Money.apartment', { number }),
        exact: true,
      })
      await expect(standing.getByText(text.StatusCard.due, { exact: true })).toBeVisible()
      await expect(standing).toContainText(formatAgorot(fee, locale))

      // Month by month: this month is due, last month paid (when it is this year's).
      const months = page.getByRole('region', { name: text.Money.monthsTitle, exact: true })
      const thisMonthRow = months.locator('li[aria-current="date"]')
      await expect(thisMonthRow).toContainText(formatMonth(currentMonth, locale))
      await expect(thisMonthRow).toContainText(text.Money.due)
      if (lastMonth.slice(0, 4) === currentMonth.slice(0, 4)) {
        await expect(
          months.getByRole('listitem').filter({ hasText: formatMonth(lastMonth, locale) }),
        ).toContainText(text.Money.paid)
      }

      // Every payment, the newest first; the voided one says so and why, and no one is named.
      const rows = historyRows(page, locale, isPhone)
      await expect(rows).toHaveCount(2)
      await expect(rows.first()).toContainText(formatMonth(currentMonth, locale))
      await expect(rows.first()).toContainText(text.Money.voided)
      await expect(rows.first()).toContainText(voidReason)
      await expect(rows.nth(1)).toContainText(formatMonth(lastMonth, locale))
      await expect(rows.nth(1)).toContainText(formatDay(lastMonthPaidOn, locale))
      await expect(rows.nth(1)).toContainText(text.PaymentMethods.transfer)
      await expect(rows.nth(1)).not.toContainText(text.Money.voided)
      await expect(page.getByRole('main')).not.toContainText(treasurer)

      // The Money tab is the current one.
      const nav = isPhone ? page.getByTestId('tab-bar') : page.getByTestId('side-nav')
      await expect(nav.getByRole('link', { name: text.Nav.money, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
    } finally {
      await deletePaymentsOf(number)
      await setBillingStart(number, currentMonth)
      // The payments were written behind the app's back, and the fund may have been cached
      // meanwhile (the link to /money/balance prefetches it).
      await useSessionOf(page, 'admin@example.com')
      await refreshFundCache(page)
    }
  })
}

test('someone in two apartments chooses which one, and the choice is in the URL', async ({
  page,
}) => {
  const text = messages.he
  const t = translator('he')
  const other = 'e2e-1'
  await addResidence(resident, other)
  await useSessionOf(page, resident)

  try {
    await page.goto('/money')
    const choice = page.getByRole('navigation', { name: text.Money.apartmentsLabel, exact: true })
    const first = choice.getByRole('link', {
      name: t('Money.apartment', { number: other }),
      exact: true,
    })
    const second = choice.getByRole('link', { name: t('Money.apartment', { number }), exact: true })
    // The first apartment by default: e2e-1, billed from this month and never paid.
    await expect(first).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('region', { name: t('Money.apartment', { number: other }), exact: true }),
    ).toContainText(text.StatusCard.due)
    await expect(
      page.getByRole('region', { name: text.Money.historyTitle, exact: true }),
    ).toContainText(text.Money.emptyTitle)

    await second.click()
    await expect(page).toHaveURL(`/money?apartment=${await apartmentIdOf(number)}`)
    await expect(second).toHaveAttribute('aria-current', 'page')
    await expect(first).not.toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('region', { name: t('Money.apartment', { number }), exact: true }),
    ).toBeVisible()
  } finally {
    await removeResidence(resident, other)
  }
})

test("someone else's apartment is a 404", async ({ page }) => {
  await useSessionOf(page, resident)

  await page.goto(`/money?apartment=${await apartmentIdOf('4')}`)

  await expect(
    page.getByRole('heading', { level: 1, name: messages.he.NotFound.title, exact: true }),
  ).toBeVisible()
})

for (const locale of ['he', 'en'] as const) {
  const text = messages[locale]
  const t = translator(locale)
  const prefix = localePrefix(locale)

  test(`a resident sees the building fund and where this year's money went, in ${locale}`, async ({
    page,
  }, testInfo) => {
    const isPhone = testInfo.project.name === 'phone'
    const year = Number(currentMonth.slice(0, 4))
    const [fund, categories] = await Promise.all([
      demoBuildingBalanceAgorot(),
      demoExpensesByCategory(year),
    ])
    await useSessionOf(page, 'resident1@example.com')

    // From the apartment's page to the fund's, through the Money pages' own links.
    await page.goto(`${prefix}/money`)
    const moneyPages = page.getByRole('navigation', { name: text.MoneyNav.label, exact: true })
    await moneyPages.getByRole('link', { name: text.Balance.title, exact: true }).click()
    await expect(page).toHaveURL(`${prefix}/money/balance`)
    await expect(
      page.getByRole('heading', { level: 1, name: text.Balance.title, exact: true }),
    ).toBeVisible()
    await expect(
      moneyPages.getByRole('link', { name: text.Balance.title, exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    // The Money tab stays the current one.
    const nav = isPhone ? page.getByTestId('tab-bar') : page.getByTestId('side-nav')
    await expect(nav.getByRole('link', { name: text.Nav.money, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // The fund now, over every year.
    await expect(
      page.getByRole('region', { name: text.Balance.nowTitle, exact: true }),
    ).toContainText(formatAgorot(fund, locale))

    // This year by default; each category in words, with its amount.
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('Balance.yearTitle', { year: String(year) }),
        exact: true,
      }),
    ).toBeVisible()
    const where = page.getByRole('list', { name: text.Balance.categoriesTitle, exact: true })
    if (categories.length === 0) {
      await expect(
        page.getByText(t('Balance.noExpensesTitle', { year: String(year) })).first(),
      ).toBeVisible()
    } else {
      await expect(where.getByRole('listitem')).toHaveCount(categories.length)
      for (const { category, amountAgorot } of categories) {
        await expect(
          where.getByRole('listitem').filter({
            hasText: text.ExpenseCategories[category as keyof typeof text.ExpenseCategories],
          }),
        ).toContainText(formatAgorot(amountAgorot, locale))
      }
    }

    // A year that is not one reads as this year; the previous year is a link away.
    await page.goto(`${prefix}/money/balance?year=nonsense`)
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('Balance.yearTitle', { year: String(year) }),
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole('link', {
        name: t('Balance.previousYear', { year: String(year - 1) }),
        exact: true,
      })
      .click()
    await expect(page).toHaveURL(`${prefix}/money/balance?year=${year - 1}`)
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('Balance.yearTitle', { year: String(year - 1) }),
        exact: true,
      }),
    ).toBeVisible()
  })
}
