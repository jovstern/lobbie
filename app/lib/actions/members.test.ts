import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeFromBuilding, setRole, type RoleFormState } from '@/app/lib/actions/members'
import { committee } from '@/app/lib/data/directory'
import { db } from '@/app/lib/db'
import { apartmentResidents, apartments, buildingMembers, buildings, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import en from '@/messages/en.json'
import he from '@/messages/he.json'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/i18n/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: Locale
    namespace: 'Authz' | 'Demo' | 'MemberErrors'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// A fixed clock: nothing here depends on the time, but the sessions need one.
const now = new Date('2026-11-02T10:00:00Z')

function sessionOf(person: typeof user.$inferSelect): Session {
  return {
    user: person,
    session: {
      id: person.id,
      userId: person.id,
      token: person.id,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    },
  }
}

async function personWithEmail(email: string) {
  const [found] = await db.select().from(user).where(eq(user.email, email))
  return found
}

async function signInAs(email: string) {
  const person = await personWithEmail(email)
  vi.mocked(getSession).mockResolvedValue(sessionOf(person))
  return person
}

async function membershipOf(userId: string) {
  const [member] = await db.select().from(buildingMembers).where(eq(buildingMembers.userId, userId))
  return member
}

async function homesOf(userId: string) {
  return db
    .select({ apartmentId: apartmentResidents.apartmentId })
    .from(apartmentResidents)
    .where(eq(apartmentResidents.userId, userId))
}

async function setRoleInDb(email: string, role: 'resident' | 'committee' | 'admin') {
  const person = await personWithEmail(email)
  await db.update(buildingMembers).set({ role }).where(eq(buildingMembers.userId, person.id))
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const empty: RoleFormState = {}

let people = 0
/** Someone new in the demo building, living in a new apartment of their own. */
async function newResident(buildingId = demoBuildingId) {
  people += 1
  const [person] = await db
    .insert(user)
    .values({ name: `Person ${people}`, email: `person${people}@test.example` })
    .returning()
  const [apartment] = await db
    .insert(apartments)
    .values({ buildingId, number: `mem-${people}`, floor: 1 })
    .returning()
  await db.insert(buildingMembers).values({ userId: person.id, buildingId })
  await db.insert(apartmentResidents).values({ userId: person.id, apartmentId: apartment.id })
  return { person, apartment }
}

let otherBuildingId: string

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now })
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
}, 30_000)

beforeEach(() => {
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
  vi.mocked(redirect).mockClear()
})

describe('authorization', () => {
  it.each(['resident1@example.com', 'committee1@example.com'])(
    'refuses %s, who is not an admin, for every action',
    async (email) => {
      const { person: target } = await newResident()
      await signInAs(email)
      const fields = { role: 'admin', committeeTitle: '' }

      expect(await setRole('en', target.id, empty, form(fields))).toEqual({
        values: fields,
        message: en.Authz.forbidden,
      })
      expect(await removeFromBuilding('en', target.id)).toEqual({ message: en.Authz.forbidden })

      expect(await membershipOf(target.id)).toMatchObject({ role: 'resident' })
      expect(await homesOf(target.id)).toHaveLength(1)
      expect(revalidatePath).not.toHaveBeenCalled()
    },
  )

  it('refuses someone signed out, and someone in no building', async () => {
    const { person: target } = await newResident()
    vi.mocked(getSession).mockResolvedValue(null)
    expect((await removeFromBuilding('en', target.id)).message).toBe(en.Authz.signedOut)

    const [loner] = await db
      .insert(user)
      .values({ name: 'Loner', email: 'loner@test.example' })
      .returning()
    vi.mocked(getSession).mockResolvedValue(sessionOf(loner))
    expect((await removeFromBuilding('en', target.id)).message).toBe(en.Authz.noMembership)
    expect(await membershipOf(target.id)).toBeDefined()
  })

  it('lets the admin do both', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')

    expect(
      await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: '' })),
    ).toEqual({ saved: { role: 'committee' }, message: null })
    expect(await removeFromBuilding('en', target.id)).toEqual({ removed: true, message: null })
  })

  it('refuses a member of another building, as if they did not exist', async () => {
    const { person: stranger } = await newResident(otherBuildingId)
    await signInAs('admin@example.com')
    const fields = { role: 'admin', committeeTitle: '' }

    expect(await setRole('en', stranger.id, empty, form(fields))).toEqual({
      values: fields,
      message: en.MemberErrors.notFound,
    })
    expect(await removeFromBuilding('en', stranger.id)).toEqual({
      message: en.MemberErrors.notFound,
    })

    expect(await membershipOf(stranger.id)).toMatchObject({
      buildingId: otherBuildingId,
      role: 'resident',
    })
    expect(await homesOf(stranger.id)).toHaveLength(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('treats a malformed id as no member', async () => {
    await signInAs('admin@example.com')

    expect(
      (await setRole('en', 'nope', empty, form({ role: 'committee', committeeTitle: '' }))).message,
    ).toBe(en.MemberErrors.notFound)
    expect((await removeFromBuilding('en', 'nope')).message).toBe(en.MemberErrors.notFound)
  })

  it('refuses every write in a demo building', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))

    try {
      const fields = { role: 'committee', committeeTitle: 'Chair' }
      expect((await setRole('en', target.id, empty, form(fields))).message).toBe(en.Demo.readOnly)
      expect((await removeFromBuilding('en', target.id)).message).toBe(en.Demo.readOnly)

      expect(await membershipOf(target.id)).toMatchObject({ role: 'resident' })
      expect(revalidatePath).not.toHaveBeenCalled()
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, demoBuildingId))
    }
  })
})

describe('setRole', () => {
  it('promotes to the committee with a trimmed title, and refreshes the pages', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')

    const state = await setRole(
      'en',
      target.id,
      empty,
      form({ role: 'committee', committeeTitle: '  Treasurer ' }),
    )

    expect(state).toEqual({ saved: { role: 'committee' }, message: null })
    expect(await membershipOf(target.id)).toMatchObject({
      role: 'committee',
      committeeTitle: 'Treasurer',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/admin/people', 'page')
    // No cached read holds roles.
    expect(updateTag).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('saves an empty title as none', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')

    await setRole('en', target.id, empty, form({ role: 'admin', committeeTitle: '  ' }))

    expect(await membershipOf(target.id)).toMatchObject({ role: 'admin', committeeTitle: null })
    await setRoleInDb(target.email, 'resident')
  })

  it('clears the title when the role becomes resident', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')
    await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: 'Chair' }))

    await setRole('en', target.id, empty, form({ role: 'resident', committeeTitle: 'Chair' }))

    expect(await membershipOf(target.id)).toMatchObject({
      role: 'resident',
      committeeTitle: null,
    })
  })

  it('clears the committee contact on demotion, so the committee page drops it', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')
    await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: 'Gardens' }))
    await db
      .update(buildingMembers)
      .set({ committeePhone: '+97235550000', committeeEmail: 'gardens@committee.example' })
      .where(eq(buildingMembers.userId, target.id))
    expect((await committee()).find((entry) => entry.name === target.name)).toMatchObject({
      committeePhone: '+97235550000',
      committeeEmail: 'gardens@committee.example',
    })

    await setRole('en', target.id, empty, form({ role: 'resident', committeeTitle: '' }))

    expect(await membershipOf(target.id)).toMatchObject({
      role: 'resident',
      committeeTitle: null,
      committeePhone: null,
      committeeEmail: null,
    })
    expect((await committee()).map((entry) => entry.name)).not.toContain(target.name)

    // Promoted again, they start with no contact rather than the old one.
    await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: 'Gardens' }))
    expect((await committee()).find((entry) => entry.name === target.name)).toMatchObject({
      committeePhone: null,
      committeeEmail: null,
    })
  })

  it('takes a title of 40 characters and refuses 41, keeping what was sent', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')

    const fits = 'x'.repeat(40)
    await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: fits }))
    expect(await membershipOf(target.id)).toMatchObject({ committeeTitle: fits })

    const fields = { role: 'committee', committeeTitle: 'y'.repeat(41) }
    expect(await setRole('en', target.id, empty, form(fields))).toEqual({
      values: fields,
      errors: { committeeTitle: [en.MemberErrors.committeeTitle] },
      message: null,
    })
    expect(await membershipOf(target.id)).toMatchObject({ committeeTitle: fits })
  })

  it('refuses a role that does not exist, in the page’s language', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')

    const state = await setRole('he', target.id, empty, form({ role: 'owner', committeeTitle: '' }))

    expect(state.errors).toEqual({ role: [he.MemberErrors.role] })
    expect(await membershipOf(target.id)).toMatchObject({ role: 'resident' })
  })

  it('never demotes the building’s only admin, not even by themselves', async () => {
    const admin = await signInAs('admin@example.com')
    const fields = { role: 'committee', committeeTitle: '' }

    expect(await setRole('en', admin.id, empty, form(fields))).toEqual({
      values: fields,
      message: en.MemberErrors.lastAdminDemote,
    })
    expect(await membershipOf(admin.id)).toMatchObject({ role: 'admin' })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('lets the only admin keep the role and change their title', async () => {
    const admin = await signInAs('admin@example.com')

    await setRole('en', admin.id, empty, form({ role: 'admin', committeeTitle: 'Chair' }))

    expect(await membershipOf(admin.id)).toMatchObject({ role: 'admin', committeeTitle: 'Chair' })
    await db
      .update(buildingMembers)
      .set({ committeeTitle: null })
      .where(eq(buildingMembers.userId, admin.id))
  })

  it('lets an admin demote themselves while another admin remains, and sends them home', async () => {
    await setRoleInDb('committee2@example.com', 'admin')
    const admin = await signInAs('admin@example.com')

    try {
      const state = await setRole(
        'he',
        admin.id,
        empty,
        form({ role: 'committee', committeeTitle: '' }),
      )

      expect(state).toEqual({ saved: { role: 'committee' }, message: null })
      expect(await membershipOf(admin.id)).toMatchObject({ role: 'committee' })
      expect(redirect).toHaveBeenCalledWith({ href: '/', locale: 'he' })
      // Their next request reads the new role: the admin pages refuse them.
      const fields = { role: 'admin', committeeTitle: '' }
      expect((await setRole('en', admin.id, empty, form(fields))).message).toBe(en.Authz.forbidden)
    } finally {
      await setRoleInDb('admin@example.com', 'admin')
      await setRoleInDb('committee2@example.com', 'committee')
    }
  })

  // PGlite has one connection and runs transactions one after the other, so the two cannot
  // interleave here: this proves that whichever runs second sees one admin left and refuses.
  // On Postgres the admin rows locked FOR UPDATE make the second wait, then re-read them.
  it('keeps one admin when two admins demote each other at once', async () => {
    await setRoleInDb('committee2@example.com', 'admin')
    const first = await personWithEmail('admin@example.com')
    const second = await personWithEmail('committee2@example.com')
    vi.mocked(getSession)
      .mockResolvedValueOnce(sessionOf(first))
      .mockResolvedValueOnce(sessionOf(second))

    try {
      const demote = { role: 'committee', committeeTitle: '' }
      const results = await Promise.all([
        setRole('en', second.id, empty, form(demote)),
        setRole('en', first.id, empty, form(demote)),
      ])

      expect(results.filter((result) => result.saved)).toHaveLength(1)
      expect(results.filter((result) => result.message)).toHaveLength(1)
      const admins = await db
        .select()
        .from(buildingMembers)
        .where(
          and(eq(buildingMembers.buildingId, demoBuildingId), eq(buildingMembers.role, 'admin')),
        )
      expect(admins).toHaveLength(1)
    } finally {
      await setRoleInDb('admin@example.com', 'admin')
      await setRoleInDb('committee2@example.com', 'committee')
    }
  })
  it('locks the building’s admins, then the person, before it counts', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')
    const statements: string[] = []
    const transaction = testDb.client.transaction.bind(testDb.client)
    const spy = vi.spyOn(testDb.client, 'transaction').mockImplementation((callback) =>
      transaction((tx) => {
        const query = tx.query.bind(tx)
        vi.spyOn(tx, 'query').mockImplementation((text, ...rest) => {
          statements.push(text)
          return query(text, ...rest)
        })
        return callback(tx)
      }),
    )

    try {
      await setRole('en', target.id, empty, form({ role: 'committee', committeeTitle: '' }))
    } finally {
      spy.mockRestore()
    }

    const [admins, person, update] = statements
    expect(admins).toMatch(
      /"role" = \$\d[\s\S]*order by "building_members"."id"[\s\S]*for update$/i,
    )
    expect(person).toMatch(/"user_id" = \$\d[\s\S]*for update$/i)
    expect(update).toMatch(/^update "building_members"/i)
  })
})

describe('removeFromBuilding', () => {
  it('removes every apartment link and the membership, and keeps the account', async () => {
    const { person: target, apartment } = await newResident()
    const [second] = await db
      .insert(apartments)
      .values({ buildingId: demoBuildingId, number: `mem-second-${target.id}`, floor: 2 })
      .returning()
    await db.insert(apartmentResidents).values({ userId: target.id, apartmentId: second.id })
    await signInAs('admin@example.com')

    expect(await removeFromBuilding('en', target.id)).toEqual({ removed: true, message: null })

    expect(await membershipOf(target.id)).toBeUndefined()
    expect(await homesOf(target.id)).toEqual([])
    expect(await personWithEmail(target.email)).toBeDefined()
    // The apartments stay, with their other residents.
    const left = await db
      .select()
      .from(apartments)
      .where(inArray(apartments.id, [apartment.id, second.id]))
    expect(left).toHaveLength(2)
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/admin/people', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/admin/apartments/[id]', 'page')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('never removes the building’s only admin', async () => {
    const admin = await signInAs('admin@example.com')

    expect(await removeFromBuilding('en', admin.id)).toEqual({
      message: en.MemberErrors.lastAdminRemove,
    })
    expect(await membershipOf(admin.id)).toMatchObject({ role: 'admin' })
    expect(await homesOf(admin.id)).toHaveLength(1)
  })

  it('removes an admin while another admin remains', async () => {
    const { person: target } = await newResident()
    await setRoleInDb(target.email, 'admin')
    await signInAs('admin@example.com')

    expect(await removeFromBuilding('en', target.id)).toEqual({ removed: true, message: null })
    expect(await membershipOf(target.id)).toBeUndefined()
  })

  it('says so when the person is already gone', async () => {
    const { person: target } = await newResident()
    await signInAs('admin@example.com')
    await removeFromBuilding('en', target.id)

    expect(await removeFromBuilding('en', target.id)).toEqual({
      message: en.MemberErrors.notFound,
    })
  })
})
