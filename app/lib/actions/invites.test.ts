import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { remove } from '@/app/lib/actions/apartments'
import { create, createAll, lookup, redeem, revoke } from '@/app/lib/actions/invites'
import { db } from '@/app/lib/db'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  invites,
  rateLimits,
  user,
} from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { generateInviteCode, hashInviteCode } from '@/app/lib/utils/invite-code'
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
// A fixed test secret for the invite hashes (never a real one).
vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-secret-for-invite-hashes')

const request = vi.hoisted(() => ({ ip: '10.0.0.1' }))
vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': request.ip }),
}))
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
    namespace: 'Authz' | 'Demo' | 'InviteErrors' | 'JoinErrors' | 'ApartmentErrors'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

const appUrl = 'http://localhost:3100'
const tEn = createTranslator({ locale: 'en', messages: en })

let adminId: string
let otherBuildingId: string
let otherApartmentId: string

async function signInAs(email: string) {
  const [found] = await db.select().from(user).where(eq(user.email, email))
  const now = new Date()
  const session: Session = {
    user: found,
    session: {
      id: 'session-id',
      userId: found.id,
      token: 'token',
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    },
  }
  vi.mocked(getSession).mockResolvedValue(session)
  return found
}

let people = 0
/** Someone new, signed in, in no building yet. */
async function newcomer({ name = `Newcomer ${people + 1}` }: { name?: string } = {}) {
  people += 1
  const email = `newcomer${people}@example.com`
  await db.insert(user).values({ name, email, emailVerified: true })
  return signInAs(email)
}

let apartmentsMade = 0
async function freshApartment(buildingId = demoBuildingId) {
  apartmentsMade += 1
  const [row] = await db
    .insert(apartments)
    .values({ buildingId, number: `inv-${apartmentsMade}`, floor: 7 })
    .returning()
  return row
}

const day = 24 * 60 * 60 * 1000

/** An invite written straight to the database, with its code. */
async function inviteFor(
  apartment: { id: string; buildingId: string },
  overrides: Partial<typeof invites.$inferInsert> = {},
) {
  const code = generateInviteCode()
  const [row] = await db
    .insert(invites)
    .values({
      buildingId: apartment.buildingId,
      apartmentId: apartment.id,
      codeHash: hashInviteCode(code),
      createdBy: adminId,
      expiresAt: new Date(Date.now() + 14 * day),
      ...overrides,
    })
    .returning()
  return { code, row }
}

async function inviteRow(id: string) {
  const [row] = await db.select().from(invites).where(eq(invites.id, id))
  return row
}

async function membershipOf(userId: string) {
  const [member] = await db.select().from(buildingMembers).where(eq(buildingMembers.userId, userId))
  const homes = await db
    .select({ apartmentId: apartmentResidents.apartmentId, isOwner: apartmentResidents.isOwner })
    .from(apartmentResidents)
    .where(eq(apartmentResidents.userId, userId))
  return { member, homes }
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

beforeAll(async () => {
  vi.stubEnv('BETTER_AUTH_URL', `${appUrl}/some/path`)
  await seed(db, { now: new Date('2026-11-02T10:00:00Z'), e2e: true })
  const [admin] = await db.select().from(user).where(eq(user.email, 'admin@example.com'))
  adminId = admin.id
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
  otherApartmentId = (await freshApartment(other.id)).id
})

beforeEach(async () => {
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
  vi.mocked(redirect).mockClear()
  await db.delete(rateLimits)
  request.ip = '10.0.0.1'
})

describe('authorization', () => {
  it.each(['resident1@example.com', 'committee1@example.com'])(
    'refuses %s, who is not an admin, every admin action',
    async (email) => {
      await signInAs(email)
      const apartment = await freshApartment()
      const { row } = await inviteFor(apartment)

      expect(await create('en', apartment.id, false)).toEqual({ message: en.Authz.forbidden })
      expect(await createAll('en', 'all')).toEqual({ message: en.Authz.forbidden })
      expect(await revoke('en', row.id)).toEqual({ message: en.Authz.forbidden })

      const left = await db.select().from(invites).where(eq(invites.apartmentId, apartment.id))
      expect(left).toEqual([row])
    },
  )

  it('refuses another building’s apartment and invite, as if they did not exist', async () => {
    await signInAs('admin@example.com')
    const { row } = await inviteFor({ id: otherApartmentId, buildingId: otherBuildingId })

    expect(await create('en', otherApartmentId, false)).toEqual({
      message: en.InviteErrors.apartmentNotFound,
    })
    expect(await revoke('en', row.id)).toEqual({ message: en.InviteErrors.inviteNotFound })
    expect((await inviteRow(row.id)).revokedAt).toBeNull()
    const made = await db.select().from(invites).where(eq(invites.apartmentId, otherApartmentId))
    expect(made).toHaveLength(1)
  })

  it('treats malformed ids as nothing of the building', async () => {
    await signInAs('admin@example.com')
    expect(await create('en', 'nope', false)).toEqual({
      message: en.InviteErrors.apartmentNotFound,
    })
    expect(await revoke('en', 'nope')).toEqual({ message: en.InviteErrors.inviteNotFound })
  })

  it('refuses every write in a demo building, redemption included', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const { code, row } = await inviteFor(apartment)
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))
    try {
      expect(await create('en', apartment.id, true)).toEqual({ message: en.Demo.readOnly })
      expect(await createAll('en', 'all')).toEqual({ message: en.Demo.readOnly })
      expect(await revoke('en', row.id)).toEqual({ message: en.Demo.readOnly })

      const visitor = await newcomer()
      expect(await redeem({ locale: 'en', code })).toEqual({ message: en.Demo.readOnly })
      expect((await membershipOf(visitor.id)).member).toBeUndefined()
      expect(await inviteRow(row.id)).toEqual(row)
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, demoBuildingId))
    }
  })

  it('asks a signed-out visitor to sign in before a code is tried', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    expect(await redeem({ locale: 'en', code: 'ABCDE23456' })).toEqual({
      message: en.Authz.signedOut,
    })
    expect(await lookup('en', {}, form({ code: 'ABCDE23456' }))).toEqual({
      code: 'ABCDE23456',
      error: en.Authz.signedOut,
    })
  })
})

describe('create', () => {
  it('stores only the hash, and answers with the code and its link once', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const before = Date.now()

    const state = await create('en', apartment.id, false)

    const created = state.created
    if (!created) throw new Error(`not created: ${state.message}`)
    expect(created.code).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/)
    const code = created.code.replace('-', '')
    expect(created.link).toBe(`${appUrl}/join/${code}`)
    expect(created.apartmentNumber).toBe(apartment.number)

    const row = await inviteRow(created.inviteId)
    expect(row.codeHash).toBe(hashInviteCode(code))
    expect(JSON.stringify(row)).not.toContain(code)
    expect(row).toMatchObject({ uses: 0, maxUses: 6, revokedAt: null, createdBy: adminId })
    const lifetime = row.expiresAt.getTime() - before
    expect(lifetime).toBeGreaterThan(14 * day - 60_000)
    expect(lifetime).toBeLessThan(14 * day + 60_000)

    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
    // No cached read includes invites.
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('leaves an active invite alone unless told to replace it', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const { row } = await inviteFor(apartment)

    expect(await create('en', apartment.id, false)).toEqual({
      message: en.InviteErrors.activeExists,
    })
    expect(await db.select().from(invites).where(eq(invites.apartmentId, apartment.id))).toEqual([
      row,
    ])
  })

  it('replaces the active invite in the same transaction', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const { row: old } = await inviteFor(apartment)

    const state = await create('en', apartment.id, true)

    expect(state.created).toBeDefined()
    expect((await inviteRow(old.id)).revokedAt).not.toBeNull()
    const active = await db
      .select()
      .from(invites)
      .where(and(eq(invites.apartmentId, apartment.id), isNull(invites.revokedAt)))
    expect(active.map((invite) => invite.id)).toEqual([state.created?.inviteId])
  })

  it('creates without asking when the last invite has expired', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    await inviteFor(apartment, { expiresAt: new Date(Date.now() - day) })

    expect((await create('en', apartment.id, false)).created).toBeDefined()
  })
})

describe('revoke', () => {
  it('stops the invite working, once', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const { row } = await inviteFor(apartment)

    expect(await revoke('en', row.id)).toEqual({ revoked: true, message: null })
    expect((await inviteRow(row.id)).revokedAt).not.toBeNull()
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')

    expect(await revoke('en', row.id)).toEqual({ message: en.InviteErrors.inviteNotFound })
  })
})

describe('createAll', () => {
  async function demoApartmentIds() {
    const rows = await db
      .select({ id: apartments.id, number: apartments.number })
      .from(apartments)
      .where(eq(apartments.buildingId, demoBuildingId))
    return new Map(rows.map((row) => [row.number, row.id]))
  }

  beforeEach(async () => {
    await db.delete(invites)
  })

  it('invites only the apartments without an active invite, in the list’s order', async () => {
    await signInAs('admin@example.com')
    const ids = await demoApartmentIds()
    const keep = await inviteFor({ id: ids.get('1') ?? '', buildingId: demoBuildingId })
    // Dead invites do not count as invited.
    await inviteFor(
      { id: ids.get('2') ?? '', buildingId: demoBuildingId },
      { revokedAt: new Date() },
    )

    const state = await createAll('en', 'missing')

    const created = state.created ?? []
    expect(state.skipped).toBe(1)
    expect(created).toHaveLength(ids.size - 1)
    expect(created.map((invite) => invite.apartmentNumber)).not.toContain('1')
    // By floor, then naturally: the e2e apartments on floor 0 first, then 2 before 3.
    expect(created.slice(0, 5).map((invite) => invite.apartmentNumber)).toEqual([
      'e2e-1',
      'e2e-2',
      'e2e-3',
      '2',
      '3',
    ])
    expect((await inviteRow(keep.row.id)).revokedAt).toBeNull()

    // The database holds hashes only: no stored value is any of the codes.
    const stored = await db.select().from(invites).where(eq(invites.buildingId, demoBuildingId))
    const text = JSON.stringify(stored)
    for (const invite of created) {
      const code = invite.code.replace('-', '')
      expect(text).not.toContain(code)
      expect(stored.map((row) => row.codeHash)).toContain(hashInviteCode(code))
      expect(invite.link).toBe(`${appUrl}/join/${code}`)
    }
  })

  it('replaces every active invite when asked to', async () => {
    await signInAs('admin@example.com')
    const ids = await demoApartmentIds()
    const old = await inviteFor({ id: ids.get('1') ?? '', buildingId: demoBuildingId })

    const state = await createAll('en', 'all')

    expect(state.skipped).toBe(0)
    expect(state.created).toHaveLength(ids.size)
    expect((await inviteRow(old.row.id)).revokedAt).not.toBeNull()
    const active = await db
      .select()
      .from(invites)
      .where(and(eq(invites.buildingId, demoBuildingId), isNull(invites.revokedAt)))
    expect(active).toHaveLength(ids.size)
  })

  it('never touches another building', async () => {
    await signInAs('admin@example.com')
    await createAll('en', 'all')
    const theirs = await db.select().from(invites).where(eq(invites.buildingId, otherBuildingId))
    expect(theirs).toEqual([])
  })
})

describe('redeem', () => {
  it('joins someone new to the apartment as a resident, and goes home', async () => {
    const apartment = await freshApartment()
    const { code, row } = await inviteFor(apartment)
    const visitor = await newcomer()

    // Typed with a dash and in lower case, as a person might.
    await redeem({ locale: 'en', code: `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}` })

    const { member, homes } = await membershipOf(visitor.id)
    expect(member).toMatchObject({ buildingId: demoBuildingId, role: 'resident' })
    expect(homes).toEqual([{ apartmentId: apartment.id, isOwner: false }])
    expect((await inviteRow(row.id)).uses).toBe(1)
    // Home welcomes them to the apartment they joined, once.
    expect(redirect).toHaveBeenCalledWith({ href: `/?joined=${apartment.id}`, locale: 'en' })
  })

  it.each(['', '   '])(
    'asks someone with no name (%j) for it on their profile, once joined',
    async (name) => {
      const apartment = await freshApartment()
      const { code } = await inviteFor(apartment)
      const visitor = await newcomer({ name })

      await redeem({ locale: 'he', code })

      expect((await membershipOf(visitor.id)).homes).toHaveLength(1)
      expect(redirect).toHaveBeenCalledWith({ href: '/profile?welcome=1', locale: 'he' })
    },
  )

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ['full', { uses: 6 }],
    ['revoked', { revokedAt: new Date() }],
  ] as const)('refuses an invite that is %s, saying so', async (status, overrides) => {
    const apartment = await freshApartment()
    const { code, row } = await inviteFor(apartment, overrides)
    const visitor = await newcomer()

    expect(await redeem({ locale: 'en', code })).toEqual({ message: en.JoinErrors[status] })
    expect(await membershipOf(visitor.id)).toEqual({ member: undefined, homes: [] })
    expect(await inviteRow(row.id)).toEqual(row)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('refuses an unknown or malformed code', async () => {
    await newcomer()
    expect(await redeem({ locale: 'en', code: generateInviteCode() })).toEqual({
      message: en.JoinErrors.invalid,
    })
    expect(await redeem({ locale: 'en', code: 'not a code' })).toEqual({
      message: en.JoinErrors.invalid,
    })
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await newcomer()
    expect(await redeem({ locale: 'he', code: generateInviteCode() })).toEqual({
      message: he.JoinErrors.invalid,
    })
  })

  it('sends someone already in the apartment home without using a place', async () => {
    const apartment = await freshApartment()
    const { code, row } = await inviteFor(apartment)
    const visitor = await newcomer()
    await redeem({ locale: 'en', code })
    vi.mocked(redirect).mockClear()

    await redeem({ locale: 'en', code })

    expect(redirect).toHaveBeenCalledWith({ href: '/', locale: 'en' })
    expect((await inviteRow(row.id)).uses).toBe(1)
    expect((await membershipOf(visitor.id)).homes).toHaveLength(1)
  })

  it('adds a second apartment of the same building', async () => {
    const first = await freshApartment()
    const second = await freshApartment()
    const visitor = await newcomer()
    await redeem({ locale: 'en', code: (await inviteFor(first)).code })

    await redeem({ locale: 'en', code: (await inviteFor(second)).code })

    const { member, homes } = await membershipOf(visitor.id)
    expect(member.role).toBe('resident')
    expect(homes.map((home) => home.apartmentId).sort()).toEqual([first.id, second.id].sort())
  })

  it('keeps a member’s role when they join another apartment', async () => {
    const committee = await signInAs('committee1@example.com')
    const { code } = await inviteFor(await freshApartment())

    await redeem({ locale: 'en', code })

    expect((await membershipOf(committee.id)).member.role).toBe('committee')
  })

  it('refuses a member of another building and gives the place back', async () => {
    const visitor = await newcomer()
    await db
      .insert(buildingMembers)
      .values({ userId: visitor.id, buildingId: otherBuildingId, role: 'resident' })
    const { code, row } = await inviteFor(await freshApartment())

    expect(await redeem({ locale: 'en', code })).toEqual({ message: en.JoinErrors.otherBuilding })

    expect(await inviteRow(row.id)).toEqual(row)
    const { member, homes } = await membershipOf(visitor.id)
    expect(member.buildingId).toBe(otherBuildingId)
    expect(homes).toEqual([])
  })

  // PGlite has one connection and runs transactions one after the other, so this cannot
  // interleave the two: it proves the guarded UPDATE leaves the second one nothing to take.
  it('lets exactly one of two people take the last place', async () => {
    const { code, row } = await inviteFor(await freshApartment(), { maxUses: 2, uses: 1 })
    const [first, second] = [await newcomer(), await newcomer()]
    const sessionOf = async (person: typeof first) => {
      const now = new Date()
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
    vi.mocked(getSession)
      .mockResolvedValueOnce(await sessionOf(first))
      .mockResolvedValueOnce(await sessionOf(second))

    const results = await Promise.all([
      redeem({ locale: 'en', code }),
      redeem({ locale: 'en', code }),
    ])

    expect(results.filter((result) => result?.message === en.JoinErrors.full)).toHaveLength(1)
    expect(redirect).toHaveBeenCalledTimes(1)
    expect((await inviteRow(row.id)).uses).toBe(2)
    const joined = await db
      .select()
      .from(buildingMembers)
      .where(inArray(buildingMembers.userId, [first.id, second.id]))
    expect(joined).toHaveLength(1)
  })

  // The limits count in fixed 15-minute windows: a fixed clock keeps a loop inside one.
  describe('its limits', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-02T10:00:01Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('takes at most 10 tries per person in 15 minutes', async () => {
      await newcomer()
      for (let i = 0; i < 10; i++) {
        request.ip = `10.0.1.${i}`
        expect(await redeem({ locale: 'en', code: generateInviteCode() })).toEqual({
          message: en.JoinErrors.invalid,
        })
      }
      request.ip = '10.0.1.99'
      const refused = await redeem({ locale: 'en', code: generateInviteCode() })
      expect(refused.message).toMatch(/^Too many attempts\. Try again in (a minute|\d+ minutes)\.$/)
    })

    it('refuses an address after 100 codes that name no invite, from any account', async () => {
      for (let i = 0; i < 100; i++) {
        // Ten tries each, within every person's own limit.
        if (i % 10 === 0) await newcomer()
        const attempt =
          i % 2 === 0
            ? (await redeem({ locale: 'en', code: generateInviteCode() })).message
            : (await lookup('en', {}, form({ code: generateInviteCode() }))).error
        expect(attempt).not.toMatch(/Too many/)
      }
      await newcomer()
      expect((await redeem({ locale: 'en', code: generateInviteCode() })).message).toMatch(
        /^Too many attempts/,
      )
      expect((await lookup('en', {}, form({ code: generateInviteCode() }))).error).toMatch(
        /^Too many attempts/,
      )
    })
  })

  it('never counts a code that works: a meeting of 40 on one Wi-Fi all join', async () => {
    const { code, row } = await inviteFor(await freshApartment(), { maxUses: 40 })

    for (let i = 0; i < 40; i++) {
      await newcomer()
      expect(await redeem({ locale: 'en', code })).toBeUndefined()
    }

    expect(redirect).toHaveBeenCalledTimes(40)
    expect((await inviteRow(row.id)).uses).toBe(40)
    const misses = await db.select().from(rateLimits).where(eq(rateLimits.key, 'join:ip:10.0.0.1'))
    expect(misses).toEqual([])
  })

  it('does not count an expired, full or revoked invite as a miss', async () => {
    await newcomer()
    const { code } = await inviteFor(await freshApartment(), { revokedAt: new Date() })
    await redeem({ locale: 'en', code })
    await lookup('en', {}, form({ code }))
    const misses = await db.select().from(rateLimits).where(eq(rateLimits.key, 'join:ip:10.0.0.1'))
    expect(misses).toEqual([])
  })
})

describe('lookup', () => {
  it('opens the invite’s page for a code it knows, whatever its state', async () => {
    const { code } = await inviteFor(await freshApartment(), { revokedAt: new Date() })
    await newcomer()

    await lookup('he', {}, form({ code: ` ${code.slice(0, 5)} ${code.slice(5).toLowerCase()}` }))

    expect(redirect).toHaveBeenCalledWith({ href: `/join/${code}`, locale: 'he' })
  })

  it('says a code of the wrong shape is mistyped, keeping what was typed', async () => {
    await newcomer()
    expect(await lookup('en', {}, form({ code: 'ABC-0O1' }))).toEqual({
      code: 'ABC-0O1',
      error: en.JoinErrors.format,
    })
  })

  it('says an unknown code is not found', async () => {
    await newcomer()
    expect(await lookup('en', {}, form({ code: 'ABCDE-23456' }))).toEqual({
      code: 'ABCDE-23456',
      error: en.JoinErrors.unknown,
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('removing an apartment', () => {
  it('is blocked by an active invite, until it is revoked', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    const { row } = await inviteFor(apartment)

    expect(await remove('en', apartment.id)).toEqual({
      message: `${en.ApartmentErrors.blocked} ${tEn('ApartmentBlockers.activeInvites')}`,
    })

    await revoke('en', row.id)
    expect(await remove('en', apartment.id)).toEqual({ removed: true, message: null })
  })

  it('deletes the dead invites with it', async () => {
    await signInAs('admin@example.com')
    const apartment = await freshApartment()
    await inviteFor(apartment, { revokedAt: new Date() })
    await inviteFor(apartment, { expiresAt: new Date(Date.now() - day) })
    await inviteFor(apartment, { uses: 6 })

    expect(await remove('en', apartment.id)).toEqual({ removed: true, message: null })

    expect(await db.select().from(invites).where(eq(invites.apartmentId, apartment.id))).toEqual([])
  })
})
