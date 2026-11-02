import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { balanceAdjustments, buildings, expenses, payments, user } from '@/app/lib/schema'
import { seed } from '@/scripts/seed'
import { balance } from './ledger'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

const now = new Date('2026-11-02T10:00:00Z')
let buildingId: string
let otherBuildingId: string

const sumOf = (rows: { amountAgorot: number }[]) =>
  rows.reduce((sum, row) => sum + row.amountAgorot, 0)

beforeAll(async () => {
  await seed(db, { now })
  const [demo] = await db.select().from(buildings).where(eq(buildings.isDemo, true))
  buildingId = demo.id
  const [treasurer] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, 'committee2@example.com'))

  await db.insert(balanceAdjustments).values([
    { buildingId, amountAgorot: -50_000, reason: 'bank fee correction', recordedBy: treasurer.id },
    { buildingId, amountAgorot: 12_300, reason: 'interest', recordedBy: treasurer.id },
  ])
  await db.insert(expenses).values({
    buildingId,
    category: 'other',
    amountAgorot: 99_999,
    spentOn: '2026-10-10',
    description: 'voided',
    recordedBy: treasurer.id,
    voidedAt: now,
    voidedBy: treasurer.id,
    voidReason: 'test',
  })

  // Another building's money must not leak into the demo building's balance.
  const [other] = await db
    .insert(buildings)
    .values({
      name: 'Other',
      address: 'Elsewhere 1',
      billingStartMonth: '2026-01',
      openingBalanceAgorot: 1_000,
    })
    .returning()
  otherBuildingId = other.id
  await db.insert(expenses).values({
    buildingId: other.id,
    category: 'water',
    amountAgorot: 7_777,
    spentOn: '2026-10-10',
    description: 'other building',
    recordedBy: treasurer.id,
  })
  await db
    .insert(balanceAdjustments)
    .values({ buildingId: other.id, amountAgorot: 500, reason: 'x', recordedBy: treasurer.id })
})

describe('balance', () => {
  it('is the opening balance plus adjustments and payments, less expenses, without voids', async () => {
    const [building] = await db.select().from(buildings).where(eq(buildings.id, buildingId))
    const adjustmentRows = await db
      .select({ amountAgorot: balanceAdjustments.amountAgorot })
      .from(balanceAdjustments)
      .where(eq(balanceAdjustments.buildingId, buildingId))
    const paymentRows = await db
      .select({ amountAgorot: payments.amountAgorot })
      .from(payments)
      .where(and(eq(payments.buildingId, buildingId), isNull(payments.voidedAt)))
    const expenseRows = await db
      .select({ amountAgorot: expenses.amountAgorot })
      .from(expenses)
      .where(and(eq(expenses.buildingId, buildingId), isNull(expenses.voidedAt)))

    const expected = {
      openingBalanceAgorot: building.openingBalanceAgorot,
      adjustmentsAgorot: sumOf(adjustmentRows),
      paymentsAgorot: sumOf(paymentRows),
      expensesAgorot: sumOf(expenseRows),
    }
    expect(expected.adjustmentsAgorot).toBe(-37_700)

    expect(await balance(buildingId)).toEqual({
      ...expected,
      totalAgorot:
        expected.openingBalanceAgorot +
        expected.adjustmentsAgorot +
        expected.paymentsAgorot -
        expected.expensesAgorot,
    })
  })

  it('is zero in every part for a building with no money recorded', async () => {
    const [empty] = await db
      .insert(buildings)
      .values({ name: 'Empty', address: 'Nowhere 1', billingStartMonth: '2026-01' })
      .returning()

    expect(await balance(empty.id)).toEqual({
      openingBalanceAgorot: 0,
      adjustmentsAgorot: 0,
      paymentsAgorot: 0,
      expensesAgorot: 0,
      totalAgorot: 0,
    })
  })

  it("keeps each building's money apart", async () => {
    expect(await balance(otherBuildingId)).toEqual({
      openingBalanceAgorot: 1_000,
      adjustmentsAgorot: 500,
      paymentsAgorot: 0,
      expensesAgorot: 7_777,
      totalAgorot: 1_000 + 500 - 7_777,
    })
  })

  it('logs and throws a short message for an unknown building', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(balance('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
      'Failed to load the balance',
    )
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/ledger',
    })
    consoleError.mockRestore()
  })
})
