import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  feeRates,
  user,
} from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { statusForUser } from './payments'
import { forApartment, list } from './fees'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record tags.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
afterAll(() => testDb.close())

// The seed bills from 12 months before "now": November 2025 through November 2026, at ₪350
// (₪450 for the penthouses 10–12), set by the treasurer. Apartment 4 owes October and November.
const now = new Date('2026-11-02T10:00:00Z')
const fee = 35_000
const penthouseFee = 45_000

let buildingId: string
let otherBuildingId: string
let otherApartmentId: string
let treasurer: { id: string; name: string }
const apartmentIds = new Map<string, string>()

const idOf = (number: string) => {
  const id = apartmentIds.get(number)
  if (id === undefined) throw new Error(`no apartment ${number}`)
  return id
}

function signInAsCommitteeOf(id: string) {
  const member: Member = {
    userId: 'not-read',
    buildingId: id,
    role: 'committee',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireRole).mockResolvedValue(member)
}

const rate = (amountAgorot: number, effectiveFrom: string, apartmentId: string | null = null) => ({
  buildingId,
  apartmentId,
  amountAgorot,
  effectiveFrom,
  createdBy: treasurer.id,
})

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
  const rows = await db
    .select({ id: apartments.id, number: apartments.number })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
  for (const row of rows) apartmentIds.set(row.number, row.id)
  const [found] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  treasurer = found

  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
  const [elsewhere] = await db
    .insert(apartments)
    .values({ buildingId: other.id, number: '1', floor: 1 })
    .returning()
  otherApartmentId = elsewhere.id
  await db.insert(feeRates).values([
    { ...rate(99_000, '2026-01'), buildingId: other.id },
    { ...rate(98_000, '2026-01', elsewhere.id), buildingId: other.id },
  ])
}, 30_000)

afterEach(async () => {
  // Back to the seed's rates.
  await db
    .delete(feeRates)
    .where(
      and(
        eq(feeRates.buildingId, buildingId),
        isNull(feeRates.apartmentId),
        ne(feeRates.effectiveFrom, '2025-11'),
      ),
    )
  await db.delete(feeRates).where(inArray(feeRates.apartmentId, [idOf('1'), idOf('4')]))
})

describe('list', () => {
  it("is the building's fee and the penthouses' own, with who set each", async () => {
    signInAsCommitteeOf(buildingId)

    const schedule = await list(now)

    const seeded = {
      effectiveFrom: '2025-11',
      until: null,
      state: 'current',
      setByName: treasurer.name,
      setAt: expect.any(Date),
      id: expect.any(String),
    }
    expect(schedule).toMatchObject({ currentMonth: '2026-11', billingStartMonth: '2025-11' })
    expect(schedule.building).toEqual([{ ...seeded, amountAgorot: fee }])
    expect(schedule.apartments).toEqual(
      ['10', '11', '12'].map((number) => ({
        apartment: { id: idOf(number), number },
        periods: [{ ...seeded, amountAgorot: penthouseFee }],
      })),
    )
  })

  it("offers every one of the building's apartments, in natural order", async () => {
    signInAsCommitteeOf(buildingId)

    const { choices } = await list(now)

    expect(choices.map(({ number }) => number)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    )
  })

  it('earlier months keep the old fee after a change', async () => {
    signInAsCommitteeOf(buildingId)
    await db.insert(feeRates).values(rate(40_000, '2026-11'))
    // Someone living in apartment 4, which has not paid October or November.
    const [person] = await db
      .insert(user)
      .values({ name: 'Four', email: 'four@example.com', emailVerified: true })
      .returning({ id: user.id })
    await db.insert(buildingMembers).values({ userId: person.id, buildingId })
    await db.insert(apartmentResidents).values({ userId: person.id, apartmentId: idOf('4') })

    const [schedule, statuses] = await Promise.all([list(now), statusForUser(person.id, now)])

    expect(
      schedule.building.map(({ amountAgorot, effectiveFrom, until, state }) => [
        amountAgorot,
        effectiveFrom,
        until,
        state,
      ]),
    ).toEqual([
      [40_000, '2026-11', null, 'current'],
      [fee, '2025-11', '2026-10', 'past'],
    ])
    // October at the old fee, November at the new one.
    expect(statuses.get(idOf('4'))).toMatchObject({
      current: { kind: 'due', dueAgorot: 40_000 },
      monthsBehind: 1,
      totalOwedAgorot: fee + 40_000,
    })
  })

  it("earlier months keep an apartment's own fee once it follows the building", async () => {
    signInAsCommitteeOf(buildingId)
    // Apartment 4 owes October and November: its own ₪450 for October, then the building's.
    await db
      .insert(feeRates)
      .values([
        rate(penthouseFee, '2026-10', idOf('4')),
        { ...rate(0, '2026-11', idOf('4')), amountAgorot: null },
      ])
    const [person] = await db
      .insert(user)
      .values({ name: 'Four again', email: 'four-again@example.com', emailVerified: true })
      .returning({ id: user.id })
    await db.insert(buildingMembers).values({ userId: person.id, buildingId })
    await db.insert(apartmentResidents).values({ userId: person.id, apartmentId: idOf('4') })

    const [schedule, fees, statuses] = await Promise.all([
      list(now),
      forApartment(idOf('4'), now),
      statusForUser(person.id, now),
    ])

    expect(statuses.get(idOf('4'))).toMatchObject({
      current: { kind: 'due', dueAgorot: fee },
      monthsBehind: 1,
      totalOwedAgorot: penthouseFee + fee,
    })
    expect(fees?.inForce).toEqual({ amountAgorot: fee, source: 'building' })
    // Its history stays whole, the newest row following the building.
    const history = [
      { amountAgorot: null, effectiveFrom: '2026-11', until: null, state: 'current' },
      { amountAgorot: penthouseFee, effectiveFrom: '2026-10', until: '2026-10', state: 'past' },
    ]
    expect(fees?.periods).toMatchObject(history)
    expect(
      schedule.apartments.find(({ apartment }) => apartment.number === '4')?.periods,
    ).toMatchObject(history)
  })

  it("never shows another building's fees", async () => {
    signInAsCommitteeOf(otherBuildingId)

    const schedule = await list(now)

    expect(schedule.building.map(({ amountAgorot }) => amountAgorot)).toEqual([99_000])
    expect(schedule.apartments).toEqual([
      { apartment: { id: otherApartmentId, number: '1' }, periods: [expect.anything()] },
    ])
    expect(schedule.choices).toEqual([{ id: otherApartmentId, number: '1' }])
  })

  it('checks the role first', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('NEXT_HTTP_ERROR_FALLBACK;404'))

    await expect(list(now)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(requireRole).toHaveBeenCalledWith('committee')
  })
})

describe('forApartment', () => {
  it("is a penthouse's own fee", async () => {
    signInAsCommitteeOf(buildingId)

    const fees = await forApartment(idOf('10'), now)

    expect(fees).toMatchObject({
      currentMonth: '2026-11',
      inForce: { amountAgorot: penthouseFee, source: 'apartment' },
      periods: [{ amountAgorot: penthouseFee, effectiveFrom: '2025-11', state: 'current' }],
      upcomingBuildingFee: null,
    })
  })

  it("is the building's fee for an apartment without its own, with its next change", async () => {
    signInAsCommitteeOf(buildingId)
    await db.insert(feeRates).values(rate(40_000, '2027-01'))

    const fees = await forApartment(idOf('1'), now)

    expect(fees).toEqual({
      currentMonth: '2026-11',
      inForce: { amountAgorot: fee, source: 'building' },
      periods: [],
      upcomingBuildingFee: { amountAgorot: 40_000, effectiveFrom: '2027-01' },
    })
  })

  it("shows its own upcoming fee, and the building's until then", async () => {
    signInAsCommitteeOf(buildingId)
    await db.insert(feeRates).values(rate(42_000, '2027-02', idOf('1')))

    const fees = await forApartment(idOf('1'), now)

    expect(fees?.inForce).toEqual({ amountAgorot: fee, source: 'building' })
    expect(fees?.periods).toMatchObject([
      { amountAgorot: 42_000, effectiveFrom: '2027-02', until: null, state: 'upcoming' },
    ])
  })

  it("leaves out the building's next fee when its own one starts first", async () => {
    signInAsCommitteeOf(buildingId)
    await db.insert(feeRates).values([rate(42_000, '2026-12', idOf('1')), rate(40_000, '2027-01')])

    const fees = await forApartment(idOf('1'), now)

    expect(fees?.upcomingBuildingFee).toBeNull()
  })

  it.each([
    ["another building's apartment", () => otherApartmentId],
    ['a malformed id', () => 'not-a-uuid'],
  ])('is null for %s', async (_, id) => {
    signInAsCommitteeOf(buildingId)

    expect(await forApartment(id(), now)).toBeNull()
  })
})
