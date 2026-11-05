import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import {
  addResident,
  apartmentIdOf,
  deleteUser,
  isMember,
  resetToResident,
  setOwner,
} from './helpers/db'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const admin = { email: 'admin@example.com', name: 'מיכל אברהם' }
const tester = { email: 'e2e2@example.com', name: 'בודקת שתיים', apartment: 'e2e-2' }
const owner = { email: 'e2e1@example.com', name: 'בודק אחד', apartment: 'e2e-1' }

test('the admin makes e2e2 a committee member, who then sees /admin, and back', async ({
  page,
  browser,
}) => {
  const testerContext = await browser.newContext()
  try {
    await useSessionOf(page, admin.email)
    await page.goto('/admin/people')
    const main = page.getByRole('main')

    // Search by the apartment's number: the URL keeps it.
    await main.getByLabel(text.People.searchLabel, { exact: true }).fill(tester.apartment)
    await expect(page).toHaveURL(`/admin/people?q=${tester.apartment}`)
    const change = main.getByRole('button', {
      name: t('PersonRole.editLabel', { name: tester.name }),
      exact: true,
    })
    await expect(change).toHaveCount(1)

    await change.click()
    const dialog = page.getByRole('dialog', {
      name: t('PersonRole.title', { name: tester.name }),
      exact: true,
    })
    await dialog.getByRole('radio', { name: text.Roles.committee, exact: true }).check()
    await dialog.getByLabel(text.PersonRole.committeeTitle, { exact: true }).fill('e2e-title')
    await dialog.getByRole('button', { name: text.PersonRole.save, exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(main.getByRole('status')).toHaveText(t('PersonRole.saved', { name: tester.name }))
    await expect(main).toContainText('e2e-title')

    // Their next request has the new role.
    const testerPage = await testerContext.newPage()
    await useSessionOf(testerPage, tester.email)
    await testerPage.goto('/admin')
    await expect(
      testerPage.getByRole('heading', { level: 1, name: text.Admin.title, exact: true }),
    ).toBeVisible()

    await change.click()
    await dialog.getByRole('radio', { name: text.Roles.resident, exact: true }).check()
    await expect(dialog.getByLabel(text.PersonRole.committeeTitle, { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: text.PersonRole.save, exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(main).not.toContainText('e2e-title')

    const response = await testerPage.goto('/admin')
    expect(response?.status()).toBe(404)
  } finally {
    await testerContext.close()
    await resetToResident(tester.email)
  }
})

test('the only admin cannot be demoted, and the dialog says why', async ({ page }) => {
  await useSessionOf(page, admin.email)
  await page.goto('/admin/people')

  await page
    .getByRole('main')
    .getByRole('button', { name: t('PersonRole.editLabel', { name: admin.name }), exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: t('PersonRole.title', { name: admin.name }),
    exact: true,
  })
  await dialog.getByRole('radio', { name: text.Roles.resident, exact: true }).check()
  await dialog.getByRole('button', { name: text.PersonRole.save, exact: true }).click()

  // Refused on the server, so nothing changed and there is nothing to clean up.
  await expect(dialog.getByText(text.MemberErrors.lastAdminDemote, { exact: true })).toBeVisible()
  await expect(dialog).toBeVisible()
})

test('the admin marks e2e-1’s resident a tenant, then an owner again', async ({ page }) => {
  const id = await apartmentIdOf(owner.apartment)
  try {
    await useSessionOf(page, admin.email)
    await page.goto(`/admin/apartments/${id}`)
    const residents = page.getByRole('region', { name: text.Residents.title, exact: true })
    const choice = residents.getByRole('group', {
      name: t('Residents.ownership', { name: owner.name }),
      exact: true,
    })
    const tenant = choice.getByRole('radio', { name: text.Residents.tenant, exact: true })
    const ownerRadio = choice.getByRole('radio', { name: text.Residents.owner, exact: true })
    await expect(ownerRadio).toBeChecked()

    await choice.getByText(text.Residents.tenant, { exact: true }).click()
    await expect(tenant).toBeChecked()
    // Saved: it is still a tenant after a reload.
    await expect(async () => {
      await page.reload()
      await expect(tenant).toBeChecked({ timeout: 1_000 })
    }).toPass()

    await choice.getByText(text.Residents.owner, { exact: true }).click()
    await expect(ownerRadio).toBeChecked()
    await expect(async () => {
      await page.reload()
      await expect(ownerRadio).toBeChecked({ timeout: 1_000 })
    }).toPass()
  } finally {
    await setOwner(owner.email, owner.apartment, true)
  }
})

test('the admin removes someone from the building, and their account stays', async ({
  page,
}, testInfo) => {
  // One person per project: the desktop and phone runs share the database.
  const leaver = {
    email: `leaver-${testInfo.project.name}@example.com`,
    name: `עוזב ${testInfo.project.name}`,
  }
  await addResident(leaver.email, leaver.name, 'e2e-3')
  try {
    await useSessionOf(page, admin.email)
    await page.goto(`/admin/people?q=${encodeURIComponent(leaver.name)}`)
    const main = page.getByRole('main')

    await main
      .getByRole('button', {
        name: t('PersonRemove.removeLabel', { name: leaver.name }),
        exact: true,
      })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('PersonRemove.title', { name: leaver.name }),
      exact: true,
    })
    await expect(confirm).toHaveAccessibleDescription(
      t('PersonRemove.description', { name: leaver.name }),
    )
    await confirm.getByRole('button', { name: text.PersonRemove.confirm, exact: true }).click()

    await expect(confirm).toBeHidden()
    await expect(main.getByRole('status')).toHaveText(
      t('PersonRemove.removed', { name: leaver.name }),
    )
    await expect(
      main.getByRole('heading', { level: 1, name: text.People.title, exact: true }),
    ).toBeFocused()
    await expect(
      main.getByRole('heading', {
        level: 2,
        name: t('People.noResultsTitle', { q: leaver.name }),
        exact: true,
      }),
    ).toBeVisible()
    expect(await isMember(leaver.email)).toBe(false)
  } finally {
    await deleteUser(leaver.email)
  }
})

test('a search with no results, then Clear: everyone again, focus on the field', async ({
  page,
}) => {
  await useSessionOf(page, admin.email)
  await page.goto('/admin/people?q=nobody-here')
  const main = page.getByRole('main')
  await expect(
    main.getByRole('heading', {
      level: 2,
      name: t('People.noResultsTitle', { q: 'nobody-here' }),
      exact: true,
    }),
  ).toBeVisible()

  await main.getByRole('button', { name: text.Search.clearLabel, exact: true }).click()

  await expect(page).toHaveURL('/admin/people')
  const field = main.getByLabel(text.People.searchLabel, { exact: true })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('')
  await expect(
    main.getByRole('button', {
      name: t('PersonRole.editLabel', { name: admin.name }),
      exact: true,
    }),
  ).toBeVisible()
})
