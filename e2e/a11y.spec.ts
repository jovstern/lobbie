import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages } from './helpers/copy'

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
