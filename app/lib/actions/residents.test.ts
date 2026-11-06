import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeFromApartment, setOwnership } from '@/app/lib/actions/residents'
import { blockerCounts } from '@/app/lib/data/apartments'
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
    namespace: 'Authz' | 'Demo' | 'ResidentErrors'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// A fixed clock: nothing here depends on the time, but the sessions need one.
const now = new Date('2026-11-02T10:00:00Z')

async function signInAs(email: string) {
  const [person] = await db.select().from(user).where(eq(user.email, email))
  const session: Session = {
    user: person,
    session: {
      id: 'session-id',
      userId: person.id,
      token: 'token',
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    },
  }
  vi.mocked(getSession).mockResolvedValue(session)
  return person
}

function ownership(isOwner: string) {
  const data = new FormData()
  data.set('isOwner', isOwner)
  return data
}

async function link(userId: string, apartmentId: string) {
  const [row] = await db
    .select()
    .from(apartmentResidents)
    .where(
      and(eq(apartmentResidents.userId, userId), eq(apartmentResidents.apartmentId, apartmentId)),
    )
  return row
}

async function membershipOf(userId: string) {
  const [member] = await db.select().from(buildingMembers).where(eq(buildingMembers.userId, userId))
  return member
}

let made = 0
async function newApartment(buildingId = demoBuildingId) {
  made += 1
  const [apartment] = await db
    .insert(apartments)
    .values({ buildingId, number: `res-${made}`, floor: 1 })
    .returning()
  return apartment
}

/** Someone new in a building, living in the given apartments (new ones by default). */
async function newResident(buildingId = demoBuildingId, homes = 1) {
  made += 1
  const [person] = await db
    .insert(user)
    .values({ name: `Resident ${made}`, email: `resident-${made}@test.example` })
    .returning()
  await db.insert(buildingMembers).values({ userId: person.id, buildingId })
  const owned = []
  for (let i = 0; i < homes; i++) owned.push(await newApartment(buildingId))
  await db
    .insert(apartmentResidents)
    .values(owned.map((apartment) => ({ userId: person.id, apartmentId: apartment.id })))
  return { person, apartments: owned }
}

let otherBuildingId: string

beforeAll(async () => {
  await seed(db, { now })
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
})

beforeEach(() => {
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
  vi.mocked(redirect).mockClear()
})

describe('authorization', () => {
  it.each(['resident1@example.com', 'committee1@example.com'])(
    'refuses %s, who is not an admin, for every action',
    async (email) => {
      const {
        person,
        apartments: [home],
      } = await newResident()
      await signInAs(email)

      expect(await setOwnership('en', person.id, home.id, {}, ownership('true'))).toEqual({
        message: en.Authz.forbidden,
      })
      expect(await removeFromApartment('en', person.id, home.id)).toEqual({
        message: en.Authz.forbidden,
      })

      expect(await link(person.id, home.id)).toMatchObject({ isOwner: false })
      expect(revalidatePath).not.toHaveBeenCalled()
    },
  )

  it('refuses another building’s resident and apartment, as if they did not exist', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident(otherBuildingId)
    await signInAs('admin@example.com')

    expect(await setOwnership('en', person.id, home.id, {}, ownership('true'))).toEqual({
      message: en.ResidentErrors.notFound,
    })
    expect(await removeFromApartment('en', person.id, home.id)).toEqual({
      message: en.ResidentErrors.notFound,
    })

    expect(await link(person.id, home.id)).toMatchObject({ isOwner: false })
    expect(await membershipOf(person.id)).toBeDefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses a resident of this building named with another building’s apartment', async () => {
    const { person } = await newResident()
    const elsewhere = await newApartment(otherBuildingId)
    await signInAs('admin@example.com')

    expect((await removeFromApartment('en', person.id, elsewhere.id)).message).toBe(
      en.ResidentErrors.notFound,
    )
    expect(await membershipOf(person.id)).toBeDefined()
  })

  it('treats malformed ids as nothing of the building', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')

    expect((await setOwnership('en', 'nope', home.id, {}, ownership('true'))).message).toBe(
      en.ResidentErrors.notFound,
    )
    expect((await removeFromApartment('en', person.id, 'nope')).message).toBe(
      en.ResidentErrors.notFound,
    )
  })

  it('refuses every write in a demo building', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))

    try {
      expect((await setOwnership('en', person.id, home.id, {}, ownership('true'))).message).toBe(
        en.Demo.readOnly,
      )
      expect((await removeFromApartment('en', person.id, home.id)).message).toBe(en.Demo.readOnly)
      expect(await link(person.id, home.id)).toMatchObject({ isOwner: false })
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, demoBuildingId))
    }
  })
})

describe('setOwnership', () => {
  it('marks a resident an owner, then a tenant again, and refreshes the pages', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')

    expect(await setOwnership('en', person.id, home.id, {}, ownership('true'))).toEqual({
      message: null,
    })
    expect(await link(person.id, home.id)).toMatchObject({ isOwner: true })
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
    expect(updateTag).not.toHaveBeenCalled()

    await setOwnership('en', person.id, home.id, {}, ownership('false'))
    expect(await link(person.id, home.id)).toMatchObject({ isOwner: false })
  })

  it('refuses anything but true or false', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')

    expect((await setOwnership('en', person.id, home.id, {}, ownership('yes'))).message).toBe(
      en.ResidentErrors.saveFailed,
    )
    expect(await link(person.id, home.id)).toMatchObject({ isOwner: false })
  })

  it('says so when the person no longer lives there', async () => {
    const { person } = await newResident()
    const elsewhere = await newApartment()
    await signInAs('admin@example.com')

    expect((await setOwnership('en', person.id, elsewhere.id, {}, ownership('true'))).message).toBe(
      en.ResidentErrors.notFound,
    )
  })
})

describe('removeFromApartment', () => {
  it('unlinks one apartment and keeps the person in the building', async () => {
    const {
      person,
      apartments: [first, second],
    } = await newResident(demoBuildingId, 2)
    await signInAs('admin@example.com')

    expect(await removeFromApartment('en', person.id, first.id)).toEqual({
      removed: true,
      message: null,
    })

    expect(await link(person.id, first.id)).toBeUndefined()
    expect(await link(person.id, second.id)).toBeDefined()
    expect(await membershipOf(person.id)).toBeDefined()
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/people', 'page')
  })

  it('takes them out of the building with their last apartment, account kept', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')

    expect(await removeFromApartment('en', person.id, home.id)).toEqual({
      removed: true,
      message: null,
    })

    expect(await link(person.id, home.id)).toBeUndefined()
    expect(await membershipOf(person.id)).toBeUndefined()
    const [account] = await db.select().from(user).where(eq(user.id, person.id))
    expect(account).toBeDefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('never takes the building’s only admin out with their last apartment', async () => {
    const admin = await signInAs('admin@example.com')
    const [home] = await db
      .select({ apartmentId: apartmentResidents.apartmentId })
      .from(apartmentResidents)
      .where(eq(apartmentResidents.userId, admin.id))

    expect(await removeFromApartment('en', admin.id, home.apartmentId)).toEqual({
      message: en.ResidentErrors.lastAdmin,
    })
    expect(await link(admin.id, home.apartmentId)).toBeDefined()
    expect(await membershipOf(admin.id)).toMatchObject({ role: 'admin' })
  })

  it('lets the only admin leave an apartment that is not their last', async () => {
    const admin = await signInAs('admin@example.com')
    const extra = await newApartment()
    await db.insert(apartmentResidents).values({ userId: admin.id, apartmentId: extra.id })

    expect(await removeFromApartment('en', admin.id, extra.id)).toEqual({
      removed: true,
      message: null,
    })
    expect(await membershipOf(admin.id)).toMatchObject({ role: 'admin' })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('updates the apartment’s resident count, which decides whether it can be removed', async () => {
    const {
      person,
      apartments: [home],
    } = await newResident()
    await signInAs('admin@example.com')
    const residentsOf = async () => {
      const [row] = await db
        .select({ residents: blockerCounts.residents })
        .from(apartments)
        .where(eq(apartments.id, home.id))
      return row.residents
    }
    expect(await residentsOf()).toBe(1)

    await removeFromApartment('en', person.id, home.id)

    expect(await residentsOf()).toBe(0)
  })
})
