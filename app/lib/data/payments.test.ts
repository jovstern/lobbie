import { and, eq } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  payments,
  user,
} from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { forApartment, statusForUser } from './payments'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record tags.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
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

let people = 0

/**
 * A new person living in the given apartments, a resident of `building` (the demo building by
 * default). Each test gets its own, so the apartments are exactly those it names.
 */
async function residentOf(apartmentIdsToJoin: string[], building = buildingId) {
  people += 1
  const [person] = await db
    .insert(user)
    .values({ name: `P${people}`, email: `p${people}@example.com`, emailVerified: true })
    .returning({ id: user.id })
  await db.insert(buildingMembers).values({ userId: person.id, buildingId: building })
  if (apartmentIdsToJoin.length > 0) {
    await db
      .insert(apartmentResidents)
      .values(apartmentIdsToJoin.map((apartmentId) => ({ userId: person.id, apartmentId })))
  }
  return person.id
}

const statusesOf = async (numbers: string[]) =>
  statusForUser(await residentOf(numbers.map(idOf)), now)

beforeAll(async () => {
  await seed(db, { now, e2e: true })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
  const rows = await db
    .select({ id: apartments.id, number: apartments.number })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
  apartmentIds = new Map(rows.map((row) => [row.number, row.id]))
})

describe('statusForUser', () => {
  it("caches only the building's part, under the building's tags", async () => {
    vi.mocked(cacheTag).mockClear()
    await statusesOf(['4'])
    expect(cacheTag).toHaveBeenCalledTimes(1)
    expect(cacheTag).toHaveBeenCalledWith(`building:${buildingId}`, `building:${buildingId}:fees`)
  })

  it('apartments 4 and 9 are behind, owing the fee for each unpaid month', async () => {
    const statuses = await statusesOf(['4', '9'])

    // Apartment 4 has not paid its last 2 months: October is overdue, November is due.
    expect(statuses.get(idOf('4'))).toEqual({
      number: '4',
      current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
      monthsBehind: 1,
      totalOwedAgorot: 2 * fee,
    })
    // Apartment 9 has not paid its last 3 months.
    expect(statuses.get(idOf('9'))).toEqual({
      number: '9',
      current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
      monthsBehind: 2,
      totalOwedAgorot: 3 * fee,
    })
  })

  it('a fully paid apartment is paid, at its own fee', async () => {
    const statuses = await statusesOf(['1', '10'])

    expect(statuses.get(idOf('1'))).toEqual({
      number: '1',
      current: { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
      monthsBehind: 0,
      totalOwedAgorot: 0,
    })
    expect(statuses.get(idOf('10'))).toEqual({
      number: '10',
      current: { kind: 'paid', dueAgorot: penthouseFee, paidAgorot: penthouseFee },
      monthsBehind: 0,
      totalOwedAgorot: 0,
    })
  })

  it('an apartment with its own billing start owes only from it', async () => {
    const statuses = await statusesOf(['e2e-1'])

    expect(statuses.get(idOf('e2e-1'))).toEqual({
      number: 'e2e-1',
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

    const statuses = await statusesOf(['4'])

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

  it("never lists another person's apartments", async () => {
    // Apartment 9's own residents exist in the seed; this person lives only in 1.
    const statuses = await statusesOf(['1'])
    expect([...statuses.keys()]).toEqual([idOf('1')])
  })

  it('gives a member of another building nothing of this building', async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
      .returning()
    const [own] = await db
      .insert(apartments)
      .values({ buildingId: other.id, number: '1', floor: 1 })
      .returning()
    // A stray residence in the demo building (as if left behind by a move) must not leak.
    const outsider = await residentOf([own.id, idOf('4')], other.id)

    const statuses = await statusForUser(outsider, now)
    expect([...statuses.keys()]).toEqual([own.id])
  })

  it('gives nothing to someone who is not a member of any building', async () => {
    const [person] = await db
      .insert(user)
      .values({ name: 'Nobody', email: 'nobody@example.com', emailVerified: true })
      .returning({ id: user.id })
    await db.insert(apartmentResidents).values({ userId: person.id, apartmentId: idOf('4') })

    expect((await statusForUser(person.id, now)).size).toBe(0)
  })

  it('lists the apartments in natural order', async () => {
    const statuses = await statusesOf(['10', '2'])
    expect([...statuses.values()].map((status) => status.number)).toEqual(['2', '10'])
  })

  it('returns an empty map for a member without apartments', async () => {
    expect((await statusesOf([])).size).toBe(0)
  })

  it('logs and throws a short message when the query fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(statusForUser('not-a-uuid', now)).rejects.toThrow(
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

describe('forApartment', () => {
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

  const owing = (month: string, kind: 'overdue' | 'due' | 'upcoming') => ({
    month,
    kind,
    dueAgorot: fee,
    paidAgorot: 0,
    remainingAgorot: fee,
  })

  it('checks the role first: the committee and up', async () => {
    signInAsCommitteeOf(buildingId)
    await forApartment(idOf('4'), now)
    expect(requireRole).toHaveBeenCalledWith('committee')
  })

  it('is what apartment 4 owes, and the months it can still pay, up to a year ahead', async () => {
    signInAsCommitteeOf(buildingId)

    const result = await forApartment(idOf('4'), now)

    expect(result).toMatchObject({
      number: '4',
      currentMonth,
      today: '2026-11-02',
      lastMonth: '2027-11',
      standing: { kind: 'overdue', monthsBehind: 1, totalOwedAgorot: 2 * fee },
    })
    expect(result?.openMonths.slice(0, 3)).toEqual([
      owing('2026-10', 'overdue'),
      owing('2026-11', 'due'),
      owing('2026-12', 'upcoming'),
    ])
    expect(result?.openMonths.at(-1)).toEqual(owing('2027-11', 'upcoming'))
    expect(result?.openMonths).toHaveLength(14)
  })

  it('lists its payments newest month first, a voided one with who voided it and why', async () => {
    signInAsCommitteeOf(buildingId)

    const result = await forApartment(idOf('2'), now)

    // The seed's 13 paid months and one voided payment.
    expect(result?.history).toHaveLength(14)
    expect(result?.historyLimited).toBe(false)
    const months = result?.history.map((payment) => payment.month) ?? []
    expect(months).toEqual(months.toSorted().reverse())
    expect(result?.history[0]).toMatchObject({
      month: currentMonth,
      amountAgorot: fee,
      recordedByName: 'רונית ביטון',
      voided: null,
    })
    const voided = result?.history.find((payment) => payment.voided)
    expect(voided).toMatchObject({
      method: 'cash',
      note: 'מזומן לגזברית',
      voided: { byName: 'רונית ביטון', reason: 'נרשם פעמיים בטעות' },
    })
    expect(voided?.paidOn).toMatch(/^\d{4}-\d{2}-04$/)
    expect(result?.standing).toEqual({ kind: 'paid' })
    // Paid through this month: only months ahead are left to pay.
    expect(result?.openMonths[0]).toEqual(owing('2026-12', 'upcoming'))
  })

  it('shows the latest 20 payments and says there are more', async () => {
    signInAsCommitteeOf(buildingId)
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    await db.insert(payments).values(
      Array.from({ length: 21 }, () => ({
        buildingId,
        apartmentId: idOf('e2e-3'),
        month: currentMonth,
        amountAgorot: 1,
        paidOn: '2026-11-01',
        method: 'cash' as const,
        recordedBy: treasurer.id,
      })),
    )

    const result = await forApartment(idOf('e2e-3'), now)

    expect(result?.history).toHaveLength(20)
    expect(result?.historyLimited).toBe(true)
    await db.delete(payments).where(eq(payments.apartmentId, idOf('e2e-3')))
  })

  it("is null for another building's apartment and for a malformed id", async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other 2', address: 'Elsewhere 2', billingStartMonth: '2026-01' })
      .returning()
    signInAsCommitteeOf(other.id)

    expect(await forApartment(idOf('4'), now)).toBeNull()
    expect(await forApartment('not-a-uuid', now)).toBeNull()
  })
})
