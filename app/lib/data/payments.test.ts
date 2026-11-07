import { and, eq } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireMember, requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  feeRates,
  payments,
  user,
} from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { arrears, forApartment, grid, history, monthlyStatus, statusForUser } from './payments'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record tags.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireMember: vi.fn(), requireRole: vi.fn() }))
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

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now, e2e: true })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
  const rows = await db
    .select({ id: apartments.id, number: apartments.number })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
  apartmentIds = new Map(rows.map((row) => [row.number, row.id]))
}, 30_000)

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

describe('forApartment', () => {
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
      firstDay: '2024-11-01',
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

describe('grid', () => {
  const paid = (month: string, amount = fee) => ({
    month,
    kind: 'paid',
    dueAgorot: amount,
    paidAgorot: amount,
  })
  const unpaid = (
    month: string,
    kind: 'overdue' | 'due' | 'upcoming',
    paidAgorot = 0,
    due = fee,
  ) => ({
    month,
    kind,
    dueAgorot: due,
    paidAgorot,
    remainingAgorot: due - paidAgorot,
  })
  const notBilled = (month: string) => ({ month, kind: 'not-billed' })
  const rowOf = (result: Awaited<ReturnType<typeof grid>>, number: string) => {
    const row = result.rows.find((candidate) => candidate.number === number)
    if (!row) throw new Error(`no row ${number}`)
    return row
  }
  const treasurerId = async () => {
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    return treasurer.id
  }

  it('checks the role first: the committee and up', async () => {
    signInAsCommitteeOf(buildingId)
    vi.mocked(requireRole).mockClear()
    await grid('2026', now)
    expect(requireRole).toHaveBeenCalledWith('committee')
  })

  it("is every apartment's year, in natural order, each month with its status", async () => {
    signInAsCommitteeOf(buildingId)

    const result = await grid('2026', now)

    expect(result).toMatchObject({ year: 2026, years: { first: 2025, last: 2027 }, currentMonth })
    expect(result.rows.map((row) => row.number)).toEqual([
      ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
      'e2e-1',
      'e2e-2',
      'e2e-3',
    ])
    const four = rowOf(result, '4')
    expect(four.id).toBe(idOf('4'))
    expect(four.standing).toEqual({ kind: 'overdue', monthsBehind: 1, totalOwedAgorot: 2 * fee })
    expect(four.months).toEqual([
      ...Array.from({ length: 9 }, (_, i) => paid(`2026-0${i + 1}`)),
      unpaid('2026-10', 'overdue'),
      unpaid('2026-11', 'due'),
      unpaid('2026-12', 'upcoming'),
    ])
    // A penthouse at its own fee; an apartment billed only from this month.
    expect(rowOf(result, '10').months[0]).toEqual(paid('2026-01', penthouseFee))
    expect(rowOf(result, 'e2e-1').months.slice(9)).toEqual([
      notBilled('2026-10'),
      unpaid('2026-11', 'due'),
      unpaid('2026-12', 'upcoming'),
    ])
  })

  it('shows the months before billing started as not billed', async () => {
    signInAsCommitteeOf(buildingId)

    const one = rowOf(await grid('2025', now), '1')

    expect(one.months.slice(0, 10)).toEqual(
      Array.from({ length: 10 }, (_, i) => notBilled(`2025-${String(i + 1).padStart(2, '0')}`)),
    )
    expect(one.months.slice(10)).toEqual([paid('2025-11'), paid('2025-12')])
  })

  it('counts a part payment, never a voided one, and each month at the fee in force', async () => {
    signInAsCommitteeOf(buildingId)
    const recordedBy = await treasurerId()
    const apartmentId = idOf('4')
    await db.insert(payments).values([
      // Part of October.
      {
        buildingId,
        apartmentId,
        month: '2026-10',
        amountAgorot: 10_000,
        paidOn: '2026-11-01',
        method: 'cash',
        recordedBy,
      },
      // November in full, then voided.
      {
        buildingId,
        apartmentId,
        month: currentMonth,
        amountAgorot: fee,
        paidOn: '2026-11-01',
        method: 'cash',
        recordedBy,
        voidedAt: now,
        voidedBy: recordedBy,
        voidReason: 'test',
      },
    ])
    // The building's fee rises from December; the penthouses keep their own.
    await db.insert(feeRates).values({
      buildingId,
      apartmentId: null,
      amountAgorot: 40_000,
      effectiveFrom: '2026-12',
      createdBy: recordedBy,
    })

    try {
      const result = await grid('2026', now)

      expect(rowOf(result, '4').months.slice(9)).toEqual([
        unpaid('2026-10', 'overdue', 10_000),
        unpaid('2026-11', 'due'),
        unpaid('2026-12', 'upcoming', 0, 40_000),
      ])
      expect(rowOf(result, '4').standing).toEqual({
        kind: 'overdue',
        monthsBehind: 1,
        totalOwedAgorot: 25_000 + fee,
      })
      expect(rowOf(result, '10').months[11]).toEqual(unpaid('2026-12', 'upcoming', 0, penthouseFee))
    } finally {
      await db
        .delete(payments)
        .where(and(eq(payments.apartmentId, apartmentId), eq(payments.month, '2026-10')))
      await db
        .delete(payments)
        .where(and(eq(payments.apartmentId, apartmentId), eq(payments.month, currentMonth)))
      await db
        .delete(feeRates)
        .where(and(eq(feeRates.buildingId, buildingId), eq(feeRates.effectiveFrom, '2026-12')))
    }
  })

  it('reads every apartment and its payments in one query, however many apartments', async () => {
    signInAsCommitteeOf(buildingId)
    const query = vi.spyOn(testDb.client, 'query')

    try {
      await grid('2026', now)
      const sent = query.mock.calls.map(([text]) => String(text))
      expect(sent.filter((text) => text.includes('"payments"'))).toHaveLength(1)
      expect(sent.filter((text) => text.includes('"apartments"'))).toHaveLength(1)
      // The other two are the building's billing and fee rates, cached in the app.
      expect(sent).toHaveLength(3)
    } finally {
      query.mockRestore()
    }
  })

  it.each([
    [undefined, 2026],
    ['not-a-year', 2026],
    ['1990', 2025],
    ['2099', 2027],
    ['2027', 2027],
  ])('shows ?year=%s as %i', async (param, year) => {
    signInAsCommitteeOf(buildingId)
    const result = await grid(param, now)
    expect(result.year).toBe(year)
    expect(result.rows[0].months[0].month).toBe(`${year}-01`)
  })

  it('lists who is behind, the largest debt first', async () => {
    signInAsCommitteeOf(buildingId)

    expect((await grid('2026', now)).arrears).toEqual({
      apartments: [
        { id: idOf('9'), number: '9', monthsBehind: 2, totalOwedAgorot: 3 * fee },
        { id: idOf('4'), number: '4', monthsBehind: 1, totalOwedAgorot: 2 * fee },
      ],
      totalOwedAgorot: 5 * fee,
    })
  })

  it("is only the other building's apartments for its committee", async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other 3', address: 'Elsewhere 3', billingStartMonth: '2026-01' })
      .returning()
    const [own] = await db
      .insert(apartments)
      .values({ buildingId: other.id, number: '1', floor: 1 })
      .returning()
    signInAsCommitteeOf(other.id)

    const result = await grid('2026', now)

    // No fee set there yet: nothing is owed.
    expect(result.rows.map((row) => row.id)).toEqual([own.id])
    expect(result.rows[0].months[0]).toEqual({ month: '2026-01', kind: 'no-fee' })
    expect(result.arrears).toEqual({ apartments: [], totalOwedAgorot: 0 })
  })

  it('lists the apartments in natural order, as the apartments page does', async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other 4', address: 'Elsewhere 4', billingStartMonth: '2026-01' })
      .returning()
    await db
      .insert(apartments)
      .values(
        ['10', 'B', '2A', '2', '1'].map((number) => ({ buildingId: other.id, number, floor: 1 })),
      )
    signInAsCommitteeOf(other.id)

    const result = await grid('2026', now)

    expect(result.rows.map((row) => row.number)).toEqual(['1', '2', '2A', '10', 'B'])
  })

  it('logs and throws a short message when the query fails', async () => {
    signInAsCommitteeOf('not-a-uuid')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(grid('2026', now)).rejects.toThrow('Failed to load the payments grid')
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/payments',
    })
    consoleError.mockRestore()
  })
})

describe('arrears', () => {
  it('checks the role first, and is who is behind, as on the grid', async () => {
    signInAsCommitteeOf(buildingId)
    vi.mocked(requireRole).mockClear()

    const result = await arrears(now)

    expect(requireRole).toHaveBeenCalledWith('committee')
    expect(result).toEqual((await grid(undefined, now)).arrears)
    expect(result.apartments.map((apartment) => apartment.number)).toEqual(['9', '4'])
  })
})

/** Signs in as a resident of the demo building (or `building`) living in these apartments. */
function signInAsResidentOf(numbers: string[], building = () => buildingId) {
  const member: Member = {
    userId: 'not-read',
    buildingId: building(),
    role: 'resident',
    apartmentIds: numbers.map(idOf),
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireMember).mockResolvedValue(member)
}

async function otherBuildingApartment() {
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other 3', address: 'Elsewhere 3', billingStartMonth: '2026-01' })
    .returning()
  const [apartment] = await db
    .insert(apartments)
    .values({ buildingId: other.id, number: '1', floor: 1 })
    .returning()
  return { buildingId: other.id, apartmentId: apartment.id }
}

describe('monthlyStatus', () => {
  const owing = (month: string, kind: 'overdue' | 'due' | 'upcoming') => ({
    month,
    kind,
    dueAgorot: fee,
    paidAgorot: 0,
    remainingAgorot: fee,
  })
  const settled = (month: string) => ({ month, kind: 'paid', dueAgorot: fee, paidAgorot: fee })

  it('checks the membership first', async () => {
    signInAsResidentOf(['4'])
    vi.mocked(requireMember).mockClear()
    await monthlyStatus(idOf('4'), now)
    expect(requireMember).toHaveBeenCalledOnce()
  })

  it("is how one of the person's apartments stands, and this year's months", async () => {
    signInAsResidentOf(['4', '9'])

    const result = await monthlyStatus(idOf('4'), now)

    expect(result).toEqual({
      number: '4',
      currentMonth,
      standing: { kind: 'overdue', monthsBehind: 1, totalOwedAgorot: 2 * fee },
      months: [
        ...Array.from({ length: 9 }, (_, i) => settled(`2026-0${i + 1}`)),
        owing('2026-10', 'overdue'),
        owing('2026-11', 'due'),
        owing('2026-12', 'upcoming'),
      ],
    })
  })

  it('counts a part payment, never a voided one', async () => {
    signInAsResidentOf(['e2e-3'])
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    const row = {
      buildingId,
      apartmentId: idOf('e2e-3'),
      month: currentMonth,
      paidOn: '2026-11-01',
      method: 'cash' as const,
      recordedBy: treasurer.id,
    }
    await db.insert(payments).values([
      { ...row, amountAgorot: 10_000 },
      { ...row, amountAgorot: 25_000, voidedAt: now, voidedBy: treasurer.id, voidReason: 'test' },
    ])

    try {
      const result = await monthlyStatus(idOf('e2e-3'), now)
      expect(result?.standing).toEqual({ kind: 'due', remainingAgorot: 25_000, partial: true })
      expect(result?.months[10]).toEqual({
        month: currentMonth,
        kind: 'due',
        dueAgorot: fee,
        paidAgorot: 10_000,
        remainingAgorot: 25_000,
      })
    } finally {
      await db.delete(payments).where(eq(payments.apartmentId, idOf('e2e-3')))
    }
  })

  it('shows an apartment not billed yet as such', async () => {
    signInAsResidentOf(['e2e-1'])

    const result = await monthlyStatus(idOf('e2e-1'), new Date('2026-10-15T10:00:00Z'))

    // Billed from November: nothing is owed in October.
    expect(result?.standing).toEqual({ kind: 'not-billed' })
    expect(result?.months[9]).toEqual({ month: '2026-10', kind: 'not-billed' })
    expect(result?.months[10]).toEqual(owing('2026-11', 'upcoming'))
  })

  it("is null for an apartment that is not the person's own", async () => {
    signInAsResidentOf(['4'])
    expect(await monthlyStatus(idOf('9'), now)).toBeNull()
    expect(await monthlyStatus('not-a-uuid', now)).toBeNull()
  })

  it("is null for another building's apartment, even one listed as the person's", async () => {
    const other = await otherBuildingApartment()
    // As if the membership listed it: the query still keeps to the person's building.
    vi.mocked(requireMember).mockResolvedValue({
      userId: 'not-read',
      buildingId,
      role: 'resident',
      apartmentIds: [other.apartmentId],
      isDemo: false,
      timeZone: 'Asia/Jerusalem',
      buildingName: 'not-read',
    })
    expect(await monthlyStatus(other.apartmentId, now)).toBeNull()

    // And a member of that other building never sees this building's apartment.
    signInAsResidentOf(['4'], () => other.buildingId)
    expect(await monthlyStatus(idOf('4'), now)).toBeNull()
  })

  it('logs and throws a short message when the query fails', async () => {
    signInAsResidentOf(['4'])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi.spyOn(testDb.client, 'query').mockRejectedValue(new Error('down'))
    try {
      await expect(monthlyStatus(idOf('4'), now)).rejects.toThrow(
        'Failed to load the monthly status',
      )
      expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
        level: 'error',
        area: 'data/payments',
      })
    } finally {
      query.mockRestore()
      consoleError.mockRestore()
    }
  })
})

describe('history', () => {
  const treasurerId = async () => {
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    return treasurer.id
  }

  it('checks the membership first', async () => {
    signInAsResidentOf(['2'])
    vi.mocked(requireMember).mockClear()
    await history(idOf('2'))
    expect(requireMember).toHaveBeenCalledOnce()
  })

  it('is every payment, newest first, a voided one with when and why but no names', async () => {
    signInAsResidentOf(['2'])

    const result = await history(idOf('2'))

    // The seed's 13 paid months and one voided payment: all of them, not the latest 20 only.
    expect(result).toHaveLength(14)
    const paidOn = result?.map((payment) => payment.paidOn) ?? []
    expect(paidOn).toEqual(paidOn.toSorted().reverse())
    expect(result?.[0]).toEqual({
      id: expect.any(String),
      month: currentMonth,
      amountAgorot: fee,
      paidOn: expect.stringMatching(/^2026-11-\d{2}$/),
      method: expect.any(String),
      voided: null,
    })
    const voided = result?.find((payment) => payment.voided)
    expect(voided?.voided).toEqual({ at: now, reason: 'נרשם פעמיים בטעות' })
    // Neither who recorded or voided it, nor the committee's note.
    expect(Object.keys(voided ?? {}).toSorted()).toEqual([
      'amountAgorot',
      'id',
      'method',
      'month',
      'paidOn',
      'voided',
    ])
  })

  it('lists more than 20 payments in full', async () => {
    signInAsResidentOf(['e2e-3'])
    const recordedBy = await treasurerId()
    await db.insert(payments).values(
      Array.from({ length: 25 }, () => ({
        buildingId,
        apartmentId: idOf('e2e-3'),
        month: currentMonth,
        amountAgorot: 1,
        paidOn: '2026-11-01',
        method: 'cash' as const,
        recordedBy,
      })),
    )
    try {
      expect(await history(idOf('e2e-3'))).toHaveLength(25)
    } finally {
      await db.delete(payments).where(eq(payments.apartmentId, idOf('e2e-3')))
    }
  })

  it('orders the same day by month, newest first, then the latest recorded, then by id', async () => {
    signInAsResidentOf(['e2e-3'])
    const recordedBy = await treasurerId()
    const row = {
      buildingId,
      apartmentId: idOf('e2e-3'),
      amountAgorot: fee,
      method: 'transfer' as const,
      recordedBy,
    }
    const earlier = new Date('2026-11-01T08:00:00Z')
    const later = new Date('2026-11-01T09:00:00Z')
    const saved = await db
      .insert(payments)
      .values([
        { ...row, month: '2026-09', paidOn: '2026-10-20', createdAt: earlier },
        { ...row, month: '2026-10', paidOn: '2026-11-01', createdAt: earlier },
        { ...row, month: '2026-11', paidOn: '2026-11-01', createdAt: earlier },
        { ...row, month: '2026-10', paidOn: '2026-11-01', createdAt: later },
        // Recorded at the same instant for the same month: the id decides, never chance.
        { ...row, month: '2026-08', paidOn: '2026-10-20', createdAt: earlier },
        { ...row, month: '2026-08', paidOn: '2026-10-20', createdAt: earlier },
      ])
      .returning({ id: payments.id })
    const [nov, octLate] = [saved[2].id, saved[3].id]
    const [sameA, sameB] = [saved[4].id, saved[5].id].toSorted().reverse()

    try {
      const result = await history(idOf('e2e-3'))
      expect(result?.map((payment) => payment.id)).toEqual([
        nov,
        octLate,
        saved[1].id,
        saved[0].id,
        sameA,
        sameB,
      ])
    } finally {
      await db.delete(payments).where(eq(payments.apartmentId, idOf('e2e-3')))
    }
  })

  it("is null for an apartment that is not the person's own, or another building's", async () => {
    signInAsResidentOf(['4'])
    expect(await history(idOf('2'))).toBeNull()
    expect(await history('not-a-uuid')).toBeNull()

    const other = await otherBuildingApartment()
    signInAsResidentOf(['2'], () => other.buildingId)
    expect(await history(idOf('2'))).toBeNull()
  })

  it('logs and throws a short message when the query fails', async () => {
    signInAsResidentOf(['2'])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi.spyOn(testDb.client, 'query').mockRejectedValue(new Error('down'))
    try {
      await expect(history(idOf('2'))).rejects.toThrow('Failed to load the payment history')
      expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
        level: 'error',
        area: 'data/payments',
      })
    } finally {
      query.mockRestore()
      consoleError.mockRestore()
    }
  })
})
