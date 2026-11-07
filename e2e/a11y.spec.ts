import AxeBuilder from '@axe-core/playwright'
import { currentMonthIn, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn, useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { apartmentIdOf, deleteInvitesOf, deleteUser } from './helpers/db'

// WCAG 2.2 AA (spec §8): zero violations on every page, in both languages.
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze()
  const summary = violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }))
  expect(summary).toEqual([])
}

const copy = {
  he: { status: 'התשלומים שלכם', fund: 'קופת הבניין', email: 'אימייל' },
  en: { status: 'Your payments', fund: 'Building fund', email: 'Email' },
} as const

/** Home once both cards have streamed in, so axe checks the content, not the skeletons. */
async function openHome(page: Page, locale: 'he' | 'en') {
  await page.goto(locale === 'en' ? '/en' : '/')
  await expect(page.getByRole('region', { name: copy[locale].status, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: copy[locale].fund, exact: true })).toBeVisible()
}

for (const locale of ['he', 'en'] as const) {
  const prefix = locale === 'en' ? '/en' : ''

  test.describe(`axe in ${locale}`, () => {
    test('sign-in', async ({ page }) => {
      await page.goto(`${prefix}/sign-in`)
      await expect(page.getByLabel(copy[locale].email, { exact: true })).toBeVisible()
      await expectNoViolations(page)
    })

    test('check-email', async ({ page }) => {
      await page.goto(`${prefix}/sign-in/check-email`)
      await expectNoViolations(page)
    })

    // Paid (success) and overdue (danger) between them use every status colour Home has.
    for (const resident of ['resident1@example.com', 'resident9@example.com']) {
      test(`Home of ${resident}`, async ({ page }) => {
        await useSessionOf(page, resident)
        await openHome(page, locale)
        await expectNoViolations(page)
      })
    }

    // Overdue (danger), and apartment 2's history with a voided payment.
    for (const member of ['resident9@example.com', 'committee1@example.com']) {
      test(`Money of ${member}`, async ({ page }) => {
        const text = messages[locale]
        await useSessionOf(page, member)
        await page.goto(`${prefix}/money`)
        // Once the apartment has streamed in, so axe checks it rather than the skeleton.
        await expect(
          page.getByRole('region', { name: text.Money.historyTitle, exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole('region', { name: text.Money.monthsTitle, exact: true }),
        ).toBeVisible()
        await expectNoViolations(page)
      })
    }

    test('More', async ({ page }) => {
      await useSessionOf(page, 'resident1@example.com')
      await page.goto(`${prefix}/more`)
      await expectNoViolations(page)
    })

    test('Profile', async ({ page }) => {
      await useSessionOf(page, 'resident1@example.com')
      await page.goto(`${prefix}/profile`)
      await expect(page.getByRole('main')).toContainText('resident1@example.com')
      await expectNoViolations(page)
    })

    test('Profile of a committee member, with the committee contact', async ({ page }) => {
      await useSessionOf(page, 'committee1@example.com')
      await page.goto(`${prefix}/profile`)
      await expect(
        page.getByRole('region', { name: messages[locale].Profile.committeeTitle, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Admin', async ({ page }) => {
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin`)
      await expect(
        page.getByRole('heading', { level: 1, name: messages[locale].Admin.title, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Admin: building details, and the adjustment dialog', async ({ page }) => {
      const text = messages[locale]
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/building`)
      await expect(
        page.getByRole('heading', { level: 1, name: text.AdminBuilding.title, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)

      await page.getByRole('button', { name: text.AdjustmentForm.open, exact: true }).click()
      await expect(
        page.getByRole('dialog', { name: text.AdjustmentForm.title, exact: true }),
      ).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: apartments, and the add dialog', async ({ page }) => {
      const text = messages[locale]
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/apartments`)
      await expect(
        page.getByRole('heading', { level: 1, name: text.AdminApartments.title, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)

      await page
        .getByRole('main')
        .getByRole('button', { name: text.ApartmentForm.open, exact: true })
        .click()
      await expect(
        page.getByRole('dialog', { name: text.ApartmentForm.addTitle, exact: true }),
      ).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: one apartment', async ({ page }) => {
      const apartment = translator(locale)('AdminApartments.apartmentTitle', { number: '1' })
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/apartments`)
      await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: apartment, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test("Admin: one apartment's payments, and the record and void dialogs", async ({ page }) => {
      const text = messages[locale]
      const t = translator(locale)
      const apartment = t('AdminApartments.apartmentTitle', { number: '1' })
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/apartments`)
      await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
      const card = page.getByRole('region', { name: text.ApartmentPayments.title, exact: true })
      // Once the payments have streamed in, so axe checks them rather than the skeleton.
      await expect(card.getByRole('listitem').first()).toBeVisible()
      await expectNoViolations(page)

      await card
        .getByRole('button', { name: t('PaymentForm.openLabel', { number: '1' }), exact: true })
        .click()
      const dialog = page.getByRole('dialog', {
        name: t('PaymentForm.title', { number: '1' }),
        exact: true,
      })
      await expect(dialog).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()

      // The newest payment's Void (this month's fee): its confirmation asks why.
      const words = {
        month: formatMonth(currentMonthIn('Asia/Jerusalem'), locale),
        amount: formatAgorot(35_000, locale),
      }
      await card
        .getByRole('button', { name: t('VoidPayment.openLabel', words), exact: true })
        .click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: payments as the committee, with an apartment open, and its dialog', async ({
      page,
    }) => {
      const text = messages[locale]
      const t = translator(locale)
      await useSessionOf(page, 'committee1@example.com')
      await page.goto(`${prefix}/admin/payments?apartment=${await apartmentIdOf('9')}`)
      const opened = page.getByRole('region', {
        name: t('AdminPayments.apartment', { number: '9' }),
        exact: true,
      })
      // Once its payments have streamed in, so axe checks them rather than the skeleton.
      await expect(opened.getByRole('listitem').first()).toBeVisible()
      await expect(
        page.getByRole('region', { name: text.AdminPayments.arrearsTitle, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)

      await opened
        .getByRole('button', { name: t('PaymentForm.openLabel', { number: '9' }), exact: true })
        .click()
      await expect(
        page.getByRole('dialog', { name: t('PaymentForm.title', { number: '9' }), exact: true }),
      ).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: people, and the role dialog', async ({ page }) => {
      const text = messages[locale]
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/people`)
      await expect(
        page.getByRole('heading', { level: 1, name: text.People.title, exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)

      const name = 'מיכל אברהם'
      await page
        .getByRole('main')
        .getByRole('button', {
          name: translator(locale)('PersonRole.editLabel', { name }),
          exact: true,
        })
        .click()
      await expect(
        page.getByRole('dialog', {
          name: translator(locale)('PersonRole.title', { name }),
          exact: true,
        }),
      ).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: people, a search with no results', async ({ page }) => {
      await useSessionOf(page, 'admin@example.com')
      await page.goto(`${prefix}/admin/people?q=nobody-here`)
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: translator(locale)('People.noResultsTitle', { q: 'nobody-here' }),
          exact: true,
        }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Admin: fees as the committee, and the fee dialog', async ({ page }) => {
      const text = messages[locale]
      await useSessionOf(page, 'committee1@example.com')
      await page.goto(`${prefix}/admin/fees`)
      // Once the apartments' own fees have streamed in, so axe checks them too.
      await expect(
        page.getByRole('region', {
          name: translator(locale)('AdminFees.apartment', { number: '10' }),
          exact: true,
        }),
      ).toBeVisible()
      await expectNoViolations(page)

      await page
        .getByRole('main')
        .getByRole('button', { name: text.FeeForm.openApartment, exact: true })
        .click()
      await expect(
        page.getByRole('dialog', { name: text.FeeForm.apartmentTitle, exact: true }),
      ).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Admin: expenses as the committee, and the void dialog', async ({ page }) => {
      const text = messages[locale]
      await useSessionOf(page, 'committee1@example.com')
      await page.goto(`${prefix}/admin/expenses`)
      const list = page.getByRole('region', { name: text.AdminExpenses.listTitle, exact: true })
      // Once the expenses have streamed in, so axe checks them rather than the skeleton.
      await expect(
        list.getByRole('button', { name: new RegExp(`^${text.VoidExpense.open}`) }).first(),
      ).toBeVisible()
      await expectNoViolations(page)

      await list
        .getByRole('button', { name: new RegExp(`^${text.VoidExpense.open}`) })
        .first()
        .click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await expectNoViolations(page)
    })

    test('Building', async ({ page }) => {
      await useSessionOf(page, 'resident1@example.com')
      await page.goto(`${prefix}/building`)
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: messages[locale].BuildingHub.title,
          exact: true,
        }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Building: directory', async ({ page }) => {
      await useSessionOf(page, 'resident1@example.com')
      await page.goto(`${prefix}/building/directory`)
      // Once the floors have streamed in, so axe checks them rather than the skeleton.
      await expect(
        page.getByRole('main').getByRole('heading', {
          level: 2,
          name: translator(locale)('Directory.floor', { floor: 1 }),
        }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Building: committee', async ({ page }) => {
      await useSessionOf(page, 'resident1@example.com')
      await page.goto(`${prefix}/building/committee`)
      await expect(
        page.getByRole('main').getByRole('heading', { level: 2, name: 'דוד כהן', exact: true }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Join: an invite, signed out', async ({ page }) => {
      // An unknown code: the card, its message and its link, with nothing to clean up.
      await page.goto(`${prefix}/join/ABCDE23456`)
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: messages[locale].JoinInvite.invalidTitle,
          exact: true,
        }),
      ).toBeVisible()
      await expectNoViolations(page)
    })

    test('Join: code entry', async ({ page }, testInfo) => {
      // Someone without a building: Home sends them to /join, where sign-in lands.
      const newcomer = `join-a11y-${locale}-${testInfo.project.name}@example.com`
      try {
        await signIn(page, newcomer, { locale, landing: `${prefix}/join` })
        await expect(
          page.getByLabel(messages[locale].JoinCodeForm.label, { exact: true }),
        ).toBeVisible()
        await expectNoViolations(page)
      } finally {
        await deleteUser(newcomer)
      }
    })

    test('Admin: one apartment with a new invite, and the revoke dialog', async ({ page }) => {
      const text = messages[locale]
      const apartment = translator(locale)('AdminApartments.apartmentTitle', { number: 'e2e-3' })
      await useSessionOf(page, 'admin@example.com')
      try {
        await page.goto(`${prefix}/admin/apartments`)
        await page.getByRole('main').getByRole('link', { name: apartment, exact: true }).click()
        const invite = page.getByRole('region', { name: text.InviteAdmin.title, exact: true })
        await invite
          .getByRole('button', { name: text.InviteAdminClient.create, exact: true })
          .click()
        await expect(
          page.getByRole('group', { name: text.InviteAdminClient.newTitle, exact: true }),
        ).toBeVisible()
        await expectNoViolations(page)

        await invite
          .getByRole('button', {
            name: translator(locale)('InviteAdminClient.revokeLabel', { number: 'e2e-3' }),
            exact: true,
          })
          .click()
        await expect(page.getByRole('alertdialog')).toBeVisible()
        // Mid-fade, colours are part transparent: axe checks the dialog as it settles.
        await page.waitForFunction(() => document.getAnimations().length === 0)
        await expectNoViolations(page)
      } finally {
        await deleteInvitesOf('e2e-3')
      }
    })

    test.describe('dark', () => {
      test.use({ colorScheme: 'dark' })

      for (const resident of ['resident1@example.com', 'resident9@example.com']) {
        test(`Home of ${resident}`, async ({ page }) => {
          await useSessionOf(page, resident)
          await openHome(page, locale)
          await expectNoViolations(page)
        })
      }
    })
  })
}
