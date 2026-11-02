import { count, eq, isNotNull, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

// Another (real) building whose member uses one of the seed's emails. The seed must leave
// all of it alone, and must not move that member into the demo building.
const sharedEmail = 'resident13@example.com'
let otherBuildingId: string
let otherBefore: Awaited<ReturnType<typeof otherBuildingRows>>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [other] = await db
    .insert(buildings)
    .values({ name: 'רחוב הזית 3', address: 'הזית 3, חיפה', billingStartMonth: '2026-01' })
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
    // so the demo building has 18 seeded members and residents.
    expect(first).toEqual({
      buildings: 2,
      apartments: 16,
      user: 19,
      buildingMembers: 19,
      apartmentResidents: 19,
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
    const [building] = await db.select().from(buildings).where(eq(buildings.isDemo, true))
    expect(building).toMatchObject({
      name: 'רחוב הרימון 12',
      isDemo: true,
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
