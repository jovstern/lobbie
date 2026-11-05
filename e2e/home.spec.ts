import { currentMonthIn, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator, type Locale } from './helpers/copy'
import { demoBuildingBalanceAgorot } from './helpers/db'

// Read-only: seeded residents, signed in once per run. Apartment 1 is paid up; apartment 9
// has not paid its last three months (two earlier ones and this one), at ₪350 each.
const paidResident = 'resident1@example.com'
const overdueResident = 'resident9@example.com'
const thisMonth = currentMonthIn('Asia/Jerusalem')

function copyFor(locale: Locale) {
  const t = translator(locale)
  const text = messages[locale]
  return {
    home: locale === 'en' ? '/en' : '/',
    status: text.StatusCard.title,
    fund: text.BalanceCard.title,
    paid: text.StatusCard.paid,
    paidUp: t('StatusCard.paidUpFor', { month: formatMonth(thisMonth, locale) }),
    overdue: text.StatusCard.overdue,
    behind: t('StatusCard.monthsBehind', { count: 2 }),
    homeTab: text.Nav.home,
  }
}

for (const locale of ['he', 'en'] as const) {
  const text = copyFor(locale)

  test.describe(`Home in ${locale}`, () => {
    test('a fully paid resident sees "paid" for this month', async ({ page }) => {
      await useSessionOf(page, paidResident)
      await page.goto(text.home)

      const status = page.getByRole('region', { name: text.status, exact: true })
      await expect(status.getByText(text.paid, { exact: true })).toBeVisible()
      await expect(status).toContainText(text.paidUp)
    })

    test('the resident of apartment 9 sees "overdue", the months behind and what is owed', async ({
      page,
    }) => {
      await useSessionOf(page, overdueResident)
      await page.goto(text.home)

      const status = page.getByRole('region', { name: text.status, exact: true })
      await expect(status.getByText(text.overdue, { exact: true })).toBeVisible()
      await expect(status).toContainText(text.behind)
      await expect(status).toContainText(formatAgorot(3 * 35_000, locale))
    })

    test('the building fund matches the seeded ledger', async ({ page }) => {
      const balance = await demoBuildingBalanceAgorot()
      await useSessionOf(page, paidResident)
      await page.goto(text.home)

      await expect(page.getByRole('region', { name: text.fund, exact: true })).toContainText(
        formatAgorot(balance, locale),
      )
    })

    test('phones get the tab bar, desktops the side nav, with Home current', async ({
      page,
      isMobile,
    }) => {
      await useSessionOf(page, paidResident)
      await page.goto(text.home)

      // Both navs carry the same accessible name ("Main") and only one is displayed at a
      // width, so a role locator cannot tell them apart; the test ids name which is which.
      const [shown, hidden] = isMobile
        ? [page.getByTestId('tab-bar'), page.getByTestId('side-nav')]
        : [page.getByTestId('side-nav'), page.getByTestId('tab-bar')]
      await expect(shown).toBeVisible()
      await expect(hidden).toBeHidden()
      await expect(shown.getByRole('link', { name: text.homeTab, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    })
  })
}

test('the language switch keeps the page, and the choice sticks', async ({ page }) => {
  await useSessionOf(page, paidResident)
  await page.goto('/more')

  await page.getByRole('banner').getByRole('link', { name: 'English', exact: true }).click()
  await expect(page).toHaveURL('/en/more')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1, name: 'More', exact: true })).toBeVisible()

  // An unprefixed (Hebrew) URL now opens in English.
  await page.goto('/')
  await expect(page).toHaveURL('/en')

  await page.getByRole('banner').getByRole('link', { name: 'עברית', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.goto('/more')
  await expect(page).toHaveURL('/more')
})

test('the language switch keeps the query too', async ({ page }) => {
  await useSessionOf(page, paidResident)
  // No page reads a query yet; `probe` stands in for one such as `?month=`.
  await page.goto('/?probe=1')

  // The switch learns the query on hydration (its server fallback cannot read it), so the
  // test waits for that before clicking, as a person would not click in that instant.
  const english = page.getByRole('banner').getByRole('link', { name: 'English', exact: true })
  await expect(english).toHaveAttribute('href', /probe=1/)
  await english.click()
  await expect(page).toHaveURL('/en?probe=1')

  const hebrew = page.getByRole('banner').getByRole('link', { name: 'עברית', exact: true })
  await expect(hebrew).toHaveAttribute('href', /probe=1/)
  await hebrew.click()
  await expect(page).toHaveURL('/?probe=1')
})

test('More leads to the profile, read-only', async ({ page }) => {
  await useSessionOf(page, paidResident)
  await page.goto('/en/more')

  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL('/en/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toContainText(paidResident)
  await expect(page.getByRole('main')).toContainText('English')
})
