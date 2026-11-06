import { demoBuildingName } from '@/scripts/demo-building'
import { expect, test } from './fixtures'
import { signIn, useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { apartmentIdOf, deleteDemoInvites, deleteInvitesOf, deleteUser } from './helpers/db'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
const joinLink = /https?:\/\/[^/\s]+\/join\/([2-9A-HJKMNP-Z]{10})/

test('the admin invites e2e-1 and someone new joins from the link', async ({
  page,
  browser,
}, testInfo) => {
  // One person per project: the desktop and phone runs share the database.
  const newcomer = `invitee-${testInfo.project.name}@example.com`
  const id = await apartmentIdOf('e2e-1')
  const visitorContext = await browser.newContext()
  // An earlier, interrupted run may have left an active invite (the button would then replace).
  await deleteInvitesOf('e2e-1')

  try {
    await useSessionOf(page, admin)
    await page.goto(`/admin/apartments/${id}`)
    const invite = page.getByRole('region', { name: text.InviteAdmin.title, exact: true })
    await invite.getByRole('button', { name: text.InviteAdminClient.create, exact: true }).click()

    const fresh = page.getByRole('group', { name: text.InviteAdminClient.newTitle, exact: true })
    await expect(fresh).toBeFocused()
    const link = (await fresh.textContent())?.match(joinLink)
    if (!link) throw new Error('no invite link on the page')
    const [url, code] = link
    await expect(invite).toContainText(t('InviteAdmin.uses', { uses: 0, max: 6 }))

    // Someone new opens it signed out, signs in from it, and lands back on it.
    const visitor = await visitorContext.newPage()
    await visitor.goto(new URL(url).pathname)
    await expect(
      visitor.getByRole('heading', {
        level: 1,
        name: t('JoinInvite.invitedTo', { number: 'e2e-1', building: demoBuildingName }),
      }),
    ).toBeVisible()
    await visitor.getByRole('link', { name: text.JoinInvite.signIn, exact: true }).click()
    await expect(visitor).toHaveURL(`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`)
    await signIn(visitor, newcomer, { landing: `/join/${code}` })

    await visitor
      .getByRole('button', { name: t('JoinInvite.join', { number: 'e2e-1' }), exact: true })
      .click()
    await expect(visitor).toHaveURL('/')
    const status = visitor.getByRole('region', { name: text.StatusCard.title, exact: true })
    // e2e-1 owes only the current month.
    await expect(status.getByText(text.StatusCard.due, { exact: true })).toBeVisible()

    await page.reload()
    await expect(invite).toContainText(t('InviteAdmin.uses', { uses: 1, max: 6 }))
  } finally {
    await visitorContext.close()
    await deleteUser(newcomer)
    await deleteInvitesOf('e2e-1')
  }
})

test('"Create invites for all" lists a link for every apartment', async ({ page }) => {
  await useSessionOf(page, admin)
  try {
    await page.goto('/admin/apartments')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: text.InviteAll.open, exact: true }).click()

    const list = main.getByRole('list', { name: text.InviteAll.listLabel, exact: true })
    const row = list.getByRole('listitem').filter({
      hasText: t('InviteAll.apartment', { number: 'e2e-2' }),
    })
    await expect(row).toContainText(joinLink)
    await expect(
      row.getByRole('button', {
        name: t('InviteAll.copyLinkLabel', { number: 'e2e-2' }),
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      main.getByRole('button', { name: text.InviteAll.copyAll, exact: true }),
    ).toBeVisible()
  } finally {
    await deleteDemoInvites()
  }
})

test('an unknown code says it is not valid', async ({ page }) => {
  await page.goto('/join/ABCDE23456')
  await expect(
    page.getByRole('heading', { level: 1, name: text.JoinInvite.invalidTitle, exact: true }),
  ).toBeVisible()
})

test('a revoked invite says so', async ({ page }) => {
  const id = await apartmentIdOf('e2e-3')
  await deleteInvitesOf('e2e-3')
  try {
    await useSessionOf(page, admin)
    await page.goto(`/admin/apartments/${id}`)
    const invite = page.getByRole('region', { name: text.InviteAdmin.title, exact: true })
    await invite.getByRole('button', { name: text.InviteAdminClient.create, exact: true }).click()
    const fresh = page.getByRole('group', { name: text.InviteAdminClient.newTitle, exact: true })
    const code = (await fresh.textContent())?.match(joinLink)?.[1]
    if (!code) throw new Error('no invite link on the page')

    await invite
      .getByRole('button', {
        name: t('InviteAdminClient.revokeLabel', { number: 'e2e-3' }),
        exact: true,
      })
      .click()
    const confirm = page.getByRole('alertdialog', {
      name: t('InviteAdminClient.revokeTitle', { number: 'e2e-3' }),
      exact: true,
    })
    await confirm
      .getByRole('button', { name: text.InviteAdminClient.revokeConfirm, exact: true })
      .click()
    await expect(confirm).toBeHidden()
    // The page's announcer, found by what it says: the copy buttons have status regions too.
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: text.InviteAdminClient.revoked }),
    ).toHaveText(text.InviteAdminClient.revoked)
    await expect(fresh).toBeHidden()

    await page.goto(`/join/${code}`)
    await expect(
      page.getByRole('heading', { level: 1, name: text.JoinInvite.revokedTitle, exact: true }),
    ).toBeVisible()
  } finally {
    await deleteInvitesOf('e2e-3')
  }
})
