import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { apartments, buildings, payments, user } from '@/app/lib/schema'
import { seed } from '@/scripts/seed'
import { statusForApartments } from './payments'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

// The seed is relative to "now": billing starts 12 months back, so 2025-11 through 2026-11.
const now = new Date('2026-11-02T10:00:00Z')
const currentMonth = '2026-11'
const fee = 35_000
const penthouseFee = 45_000

let buildingId: string
let apartmentIds: Map<string, string>

const idOf = (number: string) => {
  const id = apartmentIds.get(number)
  if (id === undefined) throw new Error(`no apartment ${number}`)
  return id
}

beforeAll(async () => {
  await seed(db, { now })
  const [demo] = await db.select().from(buildings).where(eq(buildings.isDemo, true))
  buildingId = demo.id
  const rows = await db
    .select({ id: apartments.id, number: apartments.number })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
  apartmentIds = new Map(rows.map((row) => [row.number, row.id]))
})

describe('statusForApartments', () => {
  it('apartments 4 and 9 are behind, owing the fee for each unpaid month', async () => {
    const statuses = await statusForApartments(buildingId, [idOf('4'), idOf('9')], now)

    // Apartment 4 has not paid its last 2 months: October is overdue, November is due.
    expect(statuses.get(idOf('4'))).toEqual({
      current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
      monthsBehind: 1,
      totalOwedAgorot: 2 * fee,
    })
    // Apartment 9 has not paid its last 3 months.
    expect(statuses.get(idOf('9'))).toEqual({
      current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
      monthsBehind: 2,
      totalOwedAgorot: 3 * fee,
    })
  })

  it('a fully paid apartment is paid, at its own fee', async () => {
    const statuses = await statusForApartments(buildingId, [idOf('1'), idOf('10')], now)

    expect(statuses.get(idOf('1'))).toEqual({
      current: { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
      monthsBehind: 0,
      totalOwedAgorot: 0,
    })
    expect(statuses.get(idOf('10'))).toEqual({
      current: { kind: 'paid', dueAgorot: penthouseFee, paidAgorot: penthouseFee },
      monthsBehind: 0,
      totalOwedAgorot: 0,
    })
  })

  it('an apartment with its own billing start owes only from it', async () => {
    const statuses = await statusForApartments(buildingId, [idOf('e2e-1')], now)

    expect(statuses.get(idOf('e2e-1'))).toEqual({
      current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
      monthsBehind: 0,
      totalOwedAgorot: fee,
    })
  })

  it('a voided payment does not count', async () => {
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    await db.insert(payments).values({
      buildingId,
      apartmentId: idOf('4'),
      month: currentMonth,
      amountAgorot: fee,
      paidOn: '2026-11-01',
      method: 'cash',
      recordedBy: treasurer.id,
      voidedAt: now,
      voidedBy: treasurer.id,
      voidReason: 'test',
    })

    const statuses = await statusForApartments(buildingId, [idOf('4')], now)

    expect(statuses.get(idOf('4'))?.current).toEqual({
      kind: 'due',
      dueAgorot: fee,
      paidAgorot: 0,
      remainingAgorot: fee,
    })
    await db
      .delete(payments)
      .where(and(eq(payments.apartmentId, idOf('4')), eq(payments.month, currentMonth)))
  })

  it("ignores another building's apartments, and apartments asked under the wrong building", async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
      .returning()
    const [stranger] = await db
      .insert(apartments)
      .values({ buildingId: other.id, number: '1', floor: 1 })
      .returning()

    const statuses = await statusForApartments(buildingId, [idOf('1'), stranger.id], now)
    expect([...statuses.keys()]).toEqual([idOf('1')])

    const asked = await statusForApartments(other.id, [idOf('1'), idOf('4')], now)
    expect(asked.size).toBe(0)
  })

  it('returns an empty map for no apartments', async () => {
    expect((await statusForApartments(buildingId, [], now)).size).toBe(0)
  })

  it('logs and throws a short message when the query fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(statusForApartments(buildingId, ['not-a-uuid'], now)).rejects.toThrow(
      'Failed to load payment statuses',
    )
    expect(consoleError).toHaveBeenCalledOnce()
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/payments',
    })
    consoleError.mockRestore()
  })
})
