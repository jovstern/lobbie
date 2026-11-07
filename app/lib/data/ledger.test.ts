import { and, eq, isNull } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireMember } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import {
  apartments,
  balanceAdjustments,
  buildings,
  expenses,
  payments,
  user,
} from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { balance, yearReport } from './ledger'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record tags.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireMember: vi.fn() }))
afterAll(() => testDb.close())

const now = new Date('2026-11-02T10:00:00Z')
let buildingId: string
let otherBuildingId: string

const sumOf = (rows: { amountAgorot: number }[]) =>
  rows.reduce((sum, row) => sum + row.amountAgorot, 0)

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
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
}, 30_000)

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

  it("is cached under the building's tags, which writes update", async () => {
    vi.mocked(cacheTag).mockClear()
    await balance(buildingId)
    expect(cacheTag).toHaveBeenCalledWith(
      `building:${buildingId}`,
      `building:${buildingId}:balance`,
    )
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

describe('yearReport', () => {
  // A building of its own, billed from March 2025, with money on both sides of each new year.
  let ledgerId: string
  let treasurerId: string
  const receiptKey = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c.jpg'
  const voided = (by: string) => ({ voidedAt: now, voidedBy: by, voidReason: 'test' })

  function memberOf(buildingId: string): Member {
    return {
      userId: 'not-read',
      buildingId,
      role: 'resident',
      apartmentIds: [],
      isDemo: false,
      timeZone: 'Asia/Jerusalem',
      buildingName: 'not-read',
    }
  }

  beforeAll(async () => {
    const [treasurer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'committee2@example.com'))
    treasurerId = treasurer.id
    const [ledger] = await db
      .insert(buildings)
      .values({
        name: 'Ledger',
        address: 'Ledger 1',
        billingStartMonth: '2025-03',
        openingBalanceAgorot: 100_000,
      })
      .returning()
    ledgerId = ledger.id
    const [apartment] = await db
      .insert(apartments)
      .values({ buildingId: ledgerId, number: '1', floor: 1 })
      .returning()
    const payment = {
      buildingId: ledgerId,
      apartmentId: apartment.id,
      method: 'transfer' as const,
      recordedBy: treasurerId,
    }
    await db.insert(payments).values([
      // Paid ahead, the year before billing starts.
      { ...payment, month: '2025-03', amountAgorot: 9_000, paidOn: '2024-11-20' },
      { ...payment, month: '2025-12', amountAgorot: 30_000, paidOn: '2025-12-31' },
      { ...payment, month: '2026-01', amountAgorot: 35_000, paidOn: '2026-01-01' },
      {
        ...payment,
        month: '2026-03',
        amountAgorot: 35_000,
        paidOn: '2026-03-10',
        ...voided(treasurerId),
      },
      { ...payment, month: '2026-03', amountAgorot: 20_000, paidOn: '2026-03-15' },
    ])
    const expense = { buildingId: ledgerId, recordedBy: treasurerId, description: 'x' }
    await db.insert(expenses).values([
      { ...expense, category: 'cleaning', amountAgorot: 10_000, spentOn: '2025-12-31' },
      { ...expense, category: 'cleaning', amountAgorot: 12_000, spentOn: '2026-01-01' },
      {
        ...expense,
        category: 'cleaning',
        amountAgorot: 8_000,
        spentOn: '2026-02-03',
        description: 'Stairs',
      },
      {
        ...expense,
        category: 'repairs',
        amountAgorot: 50_000,
        spentOn: '2026-02-10',
        description: 'Voided repair',
        ...voided(treasurerId),
      },
      {
        ...expense,
        category: 'water',
        amountAgorot: 5_000,
        spentOn: '2026-03-20',
        description: 'Water bill',
        receiptKey,
      },
    ])
    await db.insert(balanceAdjustments).values([
      // 00:30 on 1 January in Jerusalem, though still 31 December in UTC.
      {
        buildingId: ledgerId,
        amountAgorot: 7_000,
        reason: 'interest',
        recordedBy: treasurerId,
        createdAt: new Date('2025-12-31T22:30:00Z'),
      },
      // 23:30 on 31 December in Jerusalem.
      {
        buildingId: ledgerId,
        amountAgorot: -2_000,
        reason: 'bank fee',
        recordedBy: treasurerId,
        createdAt: new Date('2025-12-31T21:30:00Z'),
      },
    ])
  }, 30_000)

  beforeEach(() => {
    vi.mocked(requireMember).mockResolvedValue(memberOf(ledgerId))
  })

  it("is the year's money only, by the dates in the building's time zone, without voids", async () => {
    const report = await yearReport('2026', now)

    expect(requireMember).toHaveBeenCalled()
    expect(report).toMatchObject({
      year: 2026,
      years: { first: 2024, last: 2026 },
      incomeAgorot: 55_000,
      expensesAgorot: 25_000,
      adjustmentsAgorot: 7_000,
      categories: [
        { category: 'cleaning', amountAgorot: 20_000 },
        { category: 'water', amountAgorot: 5_000 },
      ],
    })
    expect(report.months.slice(0, 4)).toEqual([
      { month: '2026-01', incomeAgorot: 35_000, expensesAgorot: 12_000 },
      { month: '2026-02', incomeAgorot: 0, expensesAgorot: 8_000 },
      { month: '2026-03', incomeAgorot: 20_000, expensesAgorot: 5_000 },
      { month: '2026-04', incomeAgorot: 0, expensesAgorot: 0 },
    ])
    // Up to this month (November 2026).
    expect(report.months.at(-1)?.month).toBe('2026-11')
  })

  it('lists the expenses that count, newest first, without who recorded them', async () => {
    const { expenses: listed } = await yearReport('2026', now)

    expect(listed).toEqual([
      {
        id: expect.any(String),
        category: 'water',
        amountAgorot: 5_000,
        spentOn: '2026-03-20',
        description: 'Water bill',
        receiptKey,
      },
      {
        id: expect.any(String),
        category: 'cleaning',
        amountAgorot: 8_000,
        spentOn: '2026-02-03',
        description: 'Stairs',
        receiptKey: null,
      },
      {
        id: expect.any(String),
        category: 'cleaning',
        amountAgorot: 12_000,
        spentOn: '2026-01-01',
        description: 'x',
        receiptKey: null,
      },
    ])
  })

  it('keeps the year before apart, with its own months from billing start', async () => {
    const report = await yearReport('2025', now)

    expect(report).toMatchObject({
      year: 2025,
      incomeAgorot: 30_000,
      expensesAgorot: 10_000,
      adjustmentsAgorot: -2_000,
      categories: [{ category: 'cleaning', amountAgorot: 10_000 }],
    })
    expect(report.months.map(({ month }) => month)[0]).toBe('2025-03')
    expect(report.months).toHaveLength(10)
    expect(report.expenses.map(({ spentOn }) => spentOn)).toEqual(['2025-12-31'])
  })

  it('shows a year with no expenses: no categories, no list', async () => {
    const report = await yearReport('2024', now)

    expect(report).toMatchObject({
      year: 2024,
      incomeAgorot: 9_000,
      expensesAgorot: 0,
      adjustmentsAgorot: 0,
      categories: [],
      expenses: [],
    })
    // Only from the month paid ahead: the quiet months before it are left out.
    expect(report.months.map(({ month }) => month)).toEqual(['2024-11', '2024-12'])
  })

  it('adds up, over every year, to the money moved since the opening balance', async () => {
    const years = await Promise.all(['2024', '2025', '2026'].map((y) => yearReport(y, now)))
    const fund = await balance(ledgerId)

    const moved = years.reduce(
      (sum, year) => sum + year.incomeAgorot + year.adjustmentsAgorot - year.expensesAgorot,
      0,
    )
    expect(fund.totalAgorot).toBe(100_000 + moved)
    expect(fund.totalAgorot).toBe(100_000 + 94_000 + 5_000 - 35_000)
  })

  it.each([
    [undefined, 2026],
    ['garbage', 2026],
    [['2025', '2024'], 2026],
    ['2019', 2024],
    ['2031', 2026],
  ])('reads ?year=%j as %i: this year, or the nearest it has', async (param, year) => {
    expect((await yearReport(param, now)).year).toBe(year)
  })

  it("starts this year in the building's time zone", async () => {
    // 00:30 on 1 January 2027 in Jerusalem.
    const report = await yearReport(undefined, new Date('2026-12-31T22:30:00Z'))

    expect(report.year).toBe(2027)
    expect(report.years).toEqual({ first: 2024, last: 2027 })
    expect(report.months).toEqual([{ month: '2027-01', incomeAgorot: 0, expensesAgorot: 0 }])
  })

  it("shows only the member's own building", async () => {
    vi.mocked(requireMember).mockResolvedValue(memberOf(otherBuildingId))

    const report = await yearReport('2026', now)

    expect(report).toMatchObject({
      incomeAgorot: 0,
      expensesAgorot: 7_777,
      categories: [{ category: 'water', amountAgorot: 7_777 }],
    })
    expect(report.expenses.map(({ description }) => description)).toEqual(['other building'])
  })

  it('reads a year in three queries, however much money it has', async () => {
    const query = vi.spyOn(testDb.client, 'query')

    try {
      await yearReport('2026', now)
      expect(query).toHaveBeenCalledTimes(3)
    } finally {
      query.mockRestore()
    }
  })

  it('is cached under the building and balance tags, which every money write updates', async () => {
    vi.mocked(cacheTag).mockClear()
    await yearReport('2026', now)
    expect(cacheTag).toHaveBeenCalledWith(`building:${ledgerId}`, `building:${ledgerId}:balance`)
  })

  it('logs and throws a short message when the query fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi.spyOn(testDb.client, 'query').mockRejectedValue(new Error('down'))

    try {
      await expect(yearReport('2026', now)).rejects.toThrow('Failed to load the year')
      expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
        level: 'error',
        area: 'data/ledger',
      })
    } finally {
      query.mockRestore()
      consoleError.mockRestore()
    }
  })
})
