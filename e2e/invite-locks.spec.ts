import { demoBuildingId } from '@/scripts/demo-building'
import { expect, test } from './fixtures'
import { signIn, useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { deleteApartmentNumbered, deleteUser, withE2eSql } from './helpers/db'

// A regression test for the lock order between redeeming an invite and removing its apartment,
// on the real database: PGlite (the unit tests') has one connection, so it cannot show two
// transactions waiting on each other. The test plays the removal in SQL, the same statements
// in the same order as `apartments.remove`, while the app redeems.
const text = messages.he
const t = translator('he')
const admin = 'admin@example.com'
const joinLink = /https?:\/\/[^/\s]+\/join\/([2-9A-HJKMNP-Z]{10})/

test('redeeming waits for an apartment being removed, holding nothing of its invite', async ({
  page,
  browser,
}, testInfo) => {
  // Its own apartment and person, per project: the desktop and phone runs share the database.
  const number = `lock-${testInfo.project.name}`
  const visitorEmail = `locks-${testInfo.project.name}@example.com`
  const visitorContext = await browser.newContext()

  try {
    const apartmentId = await withE2eSql(async (sql) => {
      const [row] = await sql`
        INSERT INTO apartments (building_id, number, floor)
        VALUES (${demoBuildingId}, ${number}, 9) RETURNING id`
      return String(row.id)
    })

    // The admin creates its invite; the link is shown once.
    await useSessionOf(page, admin)
    await page.goto(`/admin/apartments/${apartmentId}`)
    const invite = page.getByRole('region', { name: text.InviteAdmin.title, exact: true })
    await invite.getByRole('button', { name: text.InviteAdminClient.create, exact: true }).click()
    const fresh = page.getByRole('group', { name: text.InviteAdminClient.newTitle, exact: true })
    const code = (await fresh.textContent())?.match(joinLink)?.[1]
    if (!code) throw new Error('no invite link on the page')

    // Someone new opens it and signs in from it.
    const visitor = await visitorContext.newPage()
    await visitor.goto(`/join/${code}`)
    await visitor.getByRole('link', { name: text.JoinInvite.signIn, exact: true }).click()
    await expect(visitor).toHaveURL(/\/sign-in\?next=/)
    await signIn(visitor, visitorEmail, { landing: `/join/${code}` })
    const join = visitor.getByRole('button', {
      name: t('JoinInvite.join', { number }),
      exact: true,
    })
    await expect(join).toBeVisible()

    await withE2eSql((removal) =>
      removal.begin(async (tx) => {
        // The removal's first step: the apartment, FOR UPDATE.
        await tx`SELECT id FROM apartments WHERE id = ${apartmentId} FOR UPDATE`
        const [{ pid }] = await tx`SELECT pg_backend_pid() AS pid`
        await join.click()

        // The redemption now waits on this transaction's lock: some backend is blocked by it.
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

        // It waits holding nothing of the invite, so the removal can delete it. Had it taken
        // the invite first, NOWAIT would fail here, and the DELETE below would deadlock.
        const free = await withE2eSql((sql) =>
          sql.begin(
            (check) => check`
              SELECT id FROM invites WHERE apartment_id = ${apartmentId} FOR UPDATE NOWAIT`,
          ),
        )
        expect(free).toHaveLength(1)

        await tx`DELETE FROM invites WHERE apartment_id = ${apartmentId}`
        await tx`DELETE FROM apartments WHERE id = ${apartmentId}`
      }),
    )

    // The apartment went, its invite with it: the code no longer opens anything.
    await expect(visitor.getByText(text.JoinErrors.invalid, { exact: true })).toBeVisible()
    await expect(visitor).toHaveURL(`/join/${code}`)
  } finally {
    await visitorContext.close()
    await deleteUser(visitorEmail)
    await withE2eSql(
      (sql) => sql`
        DELETE FROM invites WHERE apartment_id IN (
          SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
        )`,
    )
    await deleteApartmentNumbered(number)
  }
})
