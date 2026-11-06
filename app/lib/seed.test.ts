import { count, eq, isNotNull, isNull, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { demoBuildingId, demoBuildingName } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import type { Db } from './db-client'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  expenses,
  feeRates,
  payments,
  user,
} from './schema'
import { createTestDb } from './test/db'

let db: Db
let close: () => Promise<void>
const now = new Date('2026-11-02T10:00:00Z')

// Another (real) building, with the demo building's name, whose member uses one of the seed's
// emails. The seed must leave all of it alone, and must not move that member into the demo
// building.
const sharedEmail = 'resident13@example.com'
let otherBuildingId: string
let otherBefore: Awaited<ReturnType<typeof otherBuildingRows>>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [other] = await db
    .insert(buildings)
    .values({ name: demoBuildingName, address: 'הזית 3, חיפה', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
  const [apartment] = await db
    .insert(apartments)
    .values({ buildingId: other.id, number: 'A1', floor: 1 })
    .returning()
  const [member] = await db
    .insert(user)
    .values({ name: 'Original Name', email: sharedEmail })
    .returning()
  await db
    .insert(buildingMembers)
    .values({ userId: member.id, buildingId: other.id, role: 'admin' })
  await db.insert(apartmentResidents).values({ userId: member.id, apartmentId: apartment.id })
  await db.insert(feeRates).values({
    buildingId: other.id,
    amountAgorot: 20000,
    effectiveFrom: '2026-01',
    createdBy: member.id,
  })
  await db.insert(payments).values({
    buildingId: other.id,
    apartmentId: apartment.id,
    month: '2026-01',
    amountAgorot: 20000,
    paidOn: '2026-01-03',
    method: 'cash',
    recordedBy: member.id,
  })
  await db.insert(expenses).values({
    buildingId: other.id,
    category: 'garden',
    amountAgorot: 5000,
    spentOn: '2026-01-04',
    description: 'Hedge',
    recordedBy: member.id,
  })
  otherBefore = await otherBuildingRows()
})
afterAll(() => close())

async function otherBuildingRows() {
  const [person] = await db.select().from(user).where(eq(user.email, sharedEmail))
  return {
    building: await db.select().from(buildings).where(eq(buildings.id, otherBuildingId)),
    apartments: await db
      .select()
      .from(apartments)
      .where(eq(apartments.buildingId, otherBuildingId)),
    person,
    members: await db.select().from(buildingMembers).where(eq(buildingMembers.userId, person.id)),
    residents: await db
      .select()
      .from(apartmentResidents)
      .where(eq(apartmentResidents.userId, person.id)),
    fees: await db.select().from(feeRates).where(eq(feeRates.buildingId, otherBuildingId)),
    payments: await db.select().from(payments).where(eq(payments.buildingId, otherBuildingId)),
    expenses: await db.select().from(expenses).where(eq(expenses.buildingId, otherBuildingId)),
  }
}

const tables = {
  buildings,
  apartments,
  user,
  buildingMembers,
  apartmentResidents,
  feeRates,
  payments,
  expenses,
}

async function rowCounts() {
  const entries = await Promise.all(
    Object.entries(tables).map(async ([name, table]) => {
      const [row] = await db.select({ n: count() }).from(table)
      return [name, row.n] as const
    }),
  )
  return Object.fromEntries(entries)
}

describe('seed', () => {
  it('creates the demo building and is idempotent', async () => {
    await seed(db, { now })
    const first = await rowCounts()
    // Each count includes the other building's one row; the shared-email person stays there,
    // so the demo building has 15 seeded members and residents, and no e2e fixtures.
    expect(first).toEqual({
      buildings: 2,
      apartments: 13,
      user: 16,
      buildingMembers: 16,
      apartmentResidents: 16,
      feeRates: 5,
      // 12 apartments × 13 months, minus 2 + 3 unpaid months, plus the voided payment.
      payments: 153,
      expenses: 16,
    })

    await seed(db, { now })
    expect(await rowCounts()).toEqual(first)
  })

  it('leaves every row of another building untouched', async () => {
    expect(await otherBuildingRows()).toEqual(otherBefore)
  })

  it('sets up the demo building as the spec describes', async () => {
    const [building] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
    expect(building).toMatchObject({
      name: demoBuildingName,
      isDemo: false,
      timezone: 'Asia/Jerusalem',
      quorumPercent: 50,
      openingBalanceAgorot: 850_000,
      billingStartMonth: '2025-11',
    })

    const roles = await db
      .select({
        email: user.email,
        role: buildingMembers.role,
        title: buildingMembers.committeeTitle,
      })
      .from(buildingMembers)
      .innerJoin(user, eq(user.id, buildingMembers.userId))
    expect(roles).toEqual(
      expect.arrayContaining([
        { email: 'admin@example.com', role: 'admin', title: null },
        { email: 'committee1@example.com', role: 'committee', title: 'יו״ר' },
        { email: 'committee2@example.com', role: 'committee', title: 'גזבר' },
      ]),
    )
  })

  it('leaves apartments 4 and 9 behind, and voids one payment with a reason', async () => {
    const paidMonths = await db
      .select({ number: apartments.number, months: count() })
      .from(payments)
      .innerJoin(apartments, eq(apartments.id, payments.apartmentId))
      .where(isNull(payments.voidedAt))
      .groupBy(apartments.number)
    const valid = new Map(paidMonths.map((row) => [row.number, row.months]))
    expect(valid.get('1')).toBe(13)
    expect(valid.get('4')).toBe(11)
    expect(valid.get('9')).toBe(10)

    const voided = await db.select().from(payments).where(isNotNull(payments.voidedAt))
    expect(voided).toHaveLength(1)
    expect(voided[0].voidReason).toBeTruthy()
  })
})

describe('seed, demo mode', () => {
  const demoRows = () => db.select().from(buildings).where(eq(buildings.id, demoBuildingId))

  it('is not a demo building by default, so the seeded admin can write', async () => {
    await seed(db, { now })
    expect((await demoRows()).map((row) => row.isDemo)).toEqual([false])
  })

  it('marks the same building as a demo with `demo`, and is idempotent', async () => {
    const before = await rowCounts()
    const [plain] = await demoRows()

    await seed(db, { now, demo: true })
    await seed(db, { now, demo: true })

    expect(await demoRows()).toEqual([{ ...plain, isDemo: true }])
    expect(await rowCounts()).toEqual(before)
    expect(await otherBuildingRows()).toEqual(otherBefore)
  })

  it('finds the demo building again when seeded without `demo`, and clears the flag', async () => {
    const before = await rowCounts()

    await seed(db, { now })

    expect((await demoRows()).map((row) => row.isDemo)).toEqual([false])
    expect(await rowCounts()).toEqual(before)
    expect(await otherBuildingRows()).toEqual(otherBefore)
  })

  it('finds the building by its id after an admin renamed it, and restores the name', async () => {
    await db.update(buildings).set({ name: 'Renamed' }).where(eq(buildings.id, demoBuildingId))
    const before = await rowCounts()

    await seed(db, { now })

    expect((await demoRows()).map((row) => row.name)).toEqual([demoBuildingName])
    expect(await rowCounts()).toEqual(before)
    expect(await otherBuildingRows()).toEqual(otherBefore)
  })
})

describe('seed, e2e fixtures', () => {
  const fixtureApartments = () =>
    db
      .select({ number: apartments.number })
      .from(apartments)
      .where(like(apartments.number, 'e2e-%'))
      .orderBy(apartments.number)
  const fixturePeople = () =>
    db
      .select({ email: user.email })
      .from(user)
      .where(like(user.email, 'e2e%@example.com'))
      .orderBy(user.email)

  it('creates none by default, so dev never gets test rows', async () => {
    await seed(db, { now })

    expect(await fixtureApartments()).toEqual([])
    expect(await fixturePeople()).toEqual([])
  })

  it('adds apartments e2e-1..3 and their residents with `e2e`, and is idempotent', async () => {
    const before = await rowCounts()

    await seed(db, { now, e2e: true })
    const after = await rowCounts()
    await seed(db, { now, e2e: true })

    expect(await fixtureApartments()).toEqual([
      { number: 'e2e-1' },
      { number: 'e2e-2' },
      { number: 'e2e-3' },
    ])
    expect(await fixturePeople()).toEqual([
      { email: 'e2e1@example.com' },
      { email: 'e2e2@example.com' },
      { email: 'e2e3@example.com' },
    ])
    expect(after).toEqual({
      ...before,
      apartments: before.apartments + 3,
      user: before.user + 3,
      buildingMembers: before.buildingMembers + 3,
      apartmentResidents: before.apartmentResidents + 3,
    })
    expect(await rowCounts()).toEqual(after)
    expect(await otherBuildingRows()).toEqual(otherBefore)
  })
})
