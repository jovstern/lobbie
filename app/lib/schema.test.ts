import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Db } from './db-client'
import {
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
let buildingId: string
let otherBuildingId: string
let apartmentId: string
let otherApartmentId: string
let userId: string

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [building, otherBuilding] = await db
    .insert(buildings)
    .values([
      { name: 'A', address: 'A St 1', billingStartMonth: '2026-01' },
      { name: 'B', address: 'B St 2', billingStartMonth: '2026-01' },
    ])
    .returning()
  buildingId = building.id
  otherBuildingId = otherBuilding.id
  const [apartment, otherApartment] = await db
    .insert(apartments)
    .values([
      { buildingId, number: '1', floor: 1 },
      { buildingId: otherBuildingId, number: '1', floor: 1 },
    ])
    .returning()
  apartmentId = apartment.id
  otherApartmentId = otherApartment.id
  const [person] = await db
    .insert(user)
    .values({ name: 'Dana', email: 'dana@example.com' })
    .returning()
  userId = person.id
})

afterAll(() => close())

/** Asserts that a write fails on the named database constraint. */
async function expectViolation(write: Promise<unknown>, constraint: string) {
  const error = await write.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error, `expected ${constraint} to reject the write`).toBeInstanceOf(Error)
  const cause = error instanceof Error ? error.cause : undefined
  expect(cause).toMatchObject({ constraint })
}

function payment(overrides: Partial<typeof payments.$inferInsert> = {}) {
  return {
    buildingId,
    apartmentId,
    month: '2026-01',
    amountAgorot: 35000,
    paidOn: '2026-01-05',
    method: 'cash' as const,
    recordedBy: userId,
    ...overrides,
  }
}

describe('schema constraints', () => {
  it('rejects a duplicate apartment number in one building', async () => {
    await expectViolation(
      db.insert(apartments).values({ buildingId, number: '1', floor: 2 }),
      'apartments_building_id_number_unique',
    )
  })

  it.each([0, -100])('rejects a payment amount of %i', async (amountAgorot) => {
    await expectViolation(
      db.insert(payments).values(payment({ amountAgorot })),
      'payments_amount_positive',
    )
  })

  it.each(['2026-13', '2026-1', '26-01-1', '2026/01'])('rejects the month %s', async (month) => {
    await expectViolation(db.insert(payments).values(payment({ month })), 'payments_month_format')
  })

  it('accepts a payment that is fully voided', async () => {
    await expect(
      db
        .insert(payments)
        .values(payment({ voidedAt: new Date(), voidedBy: userId, voidReason: 'Twice' })),
    ).resolves.toBeDefined()
  })

  it.each([
    ['only voidedAt', () => ({ voidedAt: new Date() })],
    ['no reason', () => ({ voidedAt: new Date(), voidedBy: userId })],
    ['only a reason', () => ({ voidReason: 'Twice' })],
  ])('rejects a partly voided payment: %s', async (_case, voided) => {
    await expectViolation(
      db.insert(payments).values(payment(voided())),
      'payments_void_all_or_none',
    )
  })

  it("rejects a payment for another building's apartment", async () => {
    await expectViolation(
      db.insert(payments).values(payment({ apartmentId: otherApartmentId })),
      'payments_apartment_building_fk',
    )
  })

  it("rejects a fee override for another building's apartment", async () => {
    await expectViolation(
      db.insert(feeRates).values({
        buildingId,
        apartmentId: otherApartmentId,
        amountAgorot: 45000,
        effectiveFrom: '2026-01',
        createdBy: userId,
      }),
      'fee_rates_apartment_building_fk',
    )
  })

  it('rejects a second building default fee for the same month (nulls not distinct)', async () => {
    const fee = { buildingId, amountAgorot: 35000, effectiveFrom: '2026-02', createdBy: userId }
    await db.insert(feeRates).values(fee)
    await expectViolation(
      db.insert(feeRates).values(fee),
      'fee_rates_building_apartment_effective_from_unique',
    )
  })

  it('rejects a second building membership for one user', async () => {
    await db.insert(buildingMembers).values({ userId, buildingId })
    await expectViolation(
      db.insert(buildingMembers).values({ userId, buildingId: otherBuildingId, role: 'admin' }),
      'building_members_user_id_unique',
    )
  })

  it.each([0, 101])('rejects a quorum of %i%%', async (quorumPercent) => {
    await expectViolation(
      db
        .insert(buildings)
        .values({ name: 'Q', address: 'Q St', billingStartMonth: '2026-01', quorumPercent }),
      'buildings_quorum_percent_range',
    )
  })

  it('rejects a negative opening balance', async () => {
    await expectViolation(
      db.insert(buildings).values({
        name: 'N',
        address: 'N St',
        billingStartMonth: '2026-01',
        openingBalanceAgorot: -1,
      }),
      'buildings_opening_balance_non_negative',
    )
  })

  it.each([
    ['only voidedAt', () => ({ voidedAt: new Date() })],
    ['no voidedAt', () => ({ voidedBy: userId, voidReason: 'Wrong amount' })],
  ])('rejects a partly voided expense: %s', async (_case, voided) => {
    await expectViolation(
      db.insert(expenses).values({
        buildingId,
        category: 'repairs',
        amountAgorot: 10000,
        spentOn: '2026-01-10',
        description: 'Door',
        recordedBy: userId,
        ...voided(),
      }),
      'expenses_void_all_or_none',
    )
  })
})

const pgliteRows = z.object({ rows: z.array(z.object({ data_type: z.string() })) })

describe('auth tables', () => {
  it.each([
    ['session', 'expires_at'],
    ['user', 'created_at'],
    ['verification', 'expires_at'],
  ])('store %s.%s as timestamptz', async (table, column) => {
    const result = await db.execute(sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}`)
    // The shared Db type leaves raw results untyped; PGlite returns `{ rows }`.
    const { rows } = pgliteRows.parse(result)
    expect(rows).toEqual([{ data_type: 'timestamp with time zone' }])
  })
})
