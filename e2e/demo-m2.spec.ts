import { expect, test } from './fixtures'
import { signIn, useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { deleteDemoInvites, deleteUser } from './helpers/db'

// The M2 demo flow (plan, M2): the admin invites every apartment, someone new opens one link,
// signs in and joins, shares their phone, and appears in the directory. The pauses let a viewer
// of the recorded GIF follow it.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
const joinLink = /https?:\/\/[^/\s]+(\/join\/[2-9A-HJKMNP-Z]{10})/

test('M2 demo: invite every apartment, join from a link, share a phone, appear in the directory', async ({
  page,
  browser,
}, testInfo) => {
  const newcomer = `demo-m2-${testInfo.project.name}@example.com`
  const visitorContext = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
    recordVideo: { dir: testInfo.outputPath('visitor'), size: page.viewportSize() ?? undefined },
  })
  try {
    await useSessionOf(page, admin)
    await page.goto('/admin/apartments')
    const main = page.getByRole('main')
    await page.waitForTimeout(1000)
    await main.getByRole('button', { name: text.InviteAll.open, exact: true }).click()

    const list = main.getByRole('list', { name: text.InviteAll.listLabel, exact: true })
    const row = list.getByRole('listitem').filter({
      hasText: t('InviteAll.apartment', { number: 'e2e-1' }),
    })
    await expect(row).toContainText(joinLink)
    await page.waitForTimeout(2000)
    const path = (await row.textContent())?.match(joinLink)?.[1]
    if (!path) throw new Error('no invite link for e2e-1')

    const visitor = await visitorContext.newPage()
    await visitor.goto(path)
    await visitor.waitForTimeout(1000)
    await visitor.getByRole('link', { name: text.JoinInvite.signIn, exact: true }).click()
    // Wait for sign-in to carry the invite back as `next`, or the helper would open a bare one.
    await expect(visitor).toHaveURL(/\/sign-in\?next=%2Fjoin%2F/)
    await signIn(visitor, newcomer, { landing: path })
    await visitor.waitForTimeout(1000)
    await visitor
      .getByRole('button', { name: t('JoinInvite.join', { number: 'e2e-1' }), exact: true })
      .click()

    await expect(visitor).toHaveURL('/profile?welcome=1')
    const profile = visitor.getByRole('main')
    await profile.getByLabel(text.ProfileForm.name, { exact: true }).fill('דנה החדשה')
    await profile.getByLabel(text.ProfileForm.phone, { exact: true }).fill('052 555 9077')
    await visitor.waitForTimeout(800)
    await profile.getByRole('button', { name: text.ProfileForm.save, exact: true }).click()
    await expect(profile.getByText(text.ProfileForm.saved, { exact: true })).toBeVisible()
    const share = profile.getByRole('switch', { name: text.ContactVisibility.label, exact: true })
    await share.click()
    await expect(share).toBeChecked()
    await visitor.waitForTimeout(1500)

    await visitor.goto('/building/directory')
    const directory = visitor.getByRole('main')
    await expect(directory).toContainText('דנה החדשה')
    await expect(
      directory.getByRole('link', { name: `${text.Contact.phone} 052-555-9077`, exact: true }),
    ).toBeVisible()
    await visitor.waitForTimeout(2500)
  } finally {
    await visitorContext.close()
    await deleteUser(newcomer)
    await deleteDemoInvites()
  }
})
