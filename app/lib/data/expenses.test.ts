import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMembership, requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { buildings, expenses, user } from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { list, receipt } from './expenses'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn(), getMembership: vi.fn() }))
afterAll(() => testDb.close())

// The seed bills from 12 months before "now" (November 2025), and its 15 expenses are spent
// in the 11 months before this one.
const now = new Date('2026-11-02T10:00:00Z')
const pdfKey = '0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.pdf'
const otherKey = '7c9d2e1f-3a4b-4c5d-8e6f-0a1b2c3d4e5f.png'

let otherBuildingId: string
let treasurerId: string
let adminId: string

function memberOf(buildingId: string, role: Member['role'] = 'committee'): Member {
  return {
    userId: 'not-read',
    buildingId,
    role,
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
}

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now })
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
  const [treasurer] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  const [admin] = await db.select().from(user).where(eq(user.email, 'admin@example.com'))
  treasurerId = treasurer.id
  adminId = admin.id

  await db.insert(expenses).values([
    {
      buildingId: demoBuildingId,
      category: 'repairs',
      amountAgorot: 50_000,
      spentOn: '2026-11-01',
      description: 'Lobby door closer',
      receiptKey: pdfKey,
      recordedBy: adminId,
      voidedAt: new Date('2026-11-02T08:00:00Z'),
      voidedBy: treasurerId,
      voidReason: 'Recorded twice',
    },
    {
      buildingId: otherBuildingId,
      category: 'water',
      amountAgorot: 1_000,
      spentOn: '2026-11-01',
      description: 'Not this building',
      receiptKey: otherKey,
      recordedBy: treasurerId,
    },
  ])
}, 30_000)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
})

describe('list', () => {
  it("lists this year's expenses of the committee's building, newest first, voided ones too", async () => {
    vi.mocked(requireRole).mockResolvedValue(memberOf(demoBuildingId))

    const { expenses: rows, today, firstDay, year, years } = await list()

    expect(requireRole).toHaveBeenCalledWith('committee')
    expect(today).toBe('2026-11-02')
    // The first day of the building's billing start month: earlier is the opening balance.
    expect(firstDay).toBe('2025-11-01')
    expect(year).toBe(2026)
    expect(years).toEqual({ first: 2025, last: 2026 })
    // The seed's 15 less December 2025's, and the voided one above.
    expect(rows).toHaveLength(15)
    expect(rows.every((row) => row.spentOn.startsWith('2026-'))).toBe(true)
    expect(rows.map((row) => row.description)).not.toContain('Not this building')
    expect(rows[0]).toEqual({
      id: expect.any(String),
      category: 'repairs',
      amountAgorot: 50_000,
      spentOn: '2026-11-01',
      description: 'Lobby door closer',
      receiptKey: pdfKey,
      recordedByName: expect.any(String),
      voided: {
        at: new Date('2026-11-02T08:00:00Z'),
        byName: expect.any(String),
        reason: 'Recorded twice',
      },
    })
    const spentOn = rows.map((row) => row.spentOn)
    expect(spentOn).toEqual(spentOn.toSorted().toReversed())
    expect(rows[1]).toMatchObject({ receiptKey: null, voided: null })
  })

  it('shows the year asked for, kept within the years there are', async () => {
    vi.mocked(requireRole).mockResolvedValue(memberOf(demoBuildingId))

    const lastYear = await list('2025')
    expect(lastYear.year).toBe(2025)
    expect(lastYear.expenses.map((row) => row.spentOn)).toEqual(['2025-12-01'])
    // Before billing starts: the first year there is; after this year: this year.
    expect((await list('1999')).year).toBe(2025)
    expect((await list('1999')).expenses).toHaveLength(1)
    expect((await list('2030')).year).toBe(2026)
    // Not a year at all: this year.
    expect((await list('abc')).year).toBe(2026)
    expect((await list(['2025', '2026'])).year).toBe(2026)
  })

  it('breaks ties on the same day by when they were recorded, newest first, then by id', async () => {
    vi.mocked(requireRole).mockResolvedValue(memberOf(otherBuildingId))
    const same = {
      buildingId: otherBuildingId,
      category: 'other' as const,
      spentOn: '2026-10-10',
      recordedBy: treasurerId,
    }
    await db.insert(expenses).values([
      {
        ...same,
        amountAgorot: 1,
        description: 'First',
        createdAt: new Date('2026-10-10T08:00:00Z'),
      },
      {
        ...same,
        amountAgorot: 2,
        description: 'Second',
        createdAt: new Date('2026-10-10T09:00:00Z'),
      },
    ])

    const { expenses: rows } = await list()

    expect(rows.map((row) => row.description)).toEqual(['Not this building', 'Second', 'First'])
  })

  it('logs and throws a short message when the query fails', async () => {
    vi.mocked(requireRole).mockResolvedValue(memberOf('not-a-uuid'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(list()).rejects.toThrow('Failed to load the expenses')
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/expenses',
    })
    consoleError.mockRestore()
  })
})

describe('receipt', () => {
  it("gives any member of the expense's building its receipt, voided expense or not", async () => {
    vi.mocked(getMembership).mockResolvedValue({
      status: 'member',
      member: memberOf(demoBuildingId, 'resident'),
    })

    expect(await receipt(pdfKey)).toEqual({ spentOn: '2026-11-01' })
  })

  it("has nothing for another building's member, someone without a building, or signed out", async () => {
    vi.mocked(getMembership).mockResolvedValue({
      status: 'member',
      member: memberOf(otherBuildingId, 'admin'),
    })
    expect(await receipt(pdfKey)).toBeNull()

    vi.mocked(getMembership).mockResolvedValue({ status: 'no-membership' })
    expect(await receipt(pdfKey)).toBeNull()

    vi.mocked(getMembership).mockResolvedValue({ status: 'signed-out' })
    expect(await receipt(pdfKey)).toBeNull()
  })

  it('has nothing for a key no expense names, or one that is not a key', async () => {
    vi.mocked(getMembership).mockResolvedValue({
      status: 'member',
      member: memberOf(demoBuildingId),
    })

    expect(await receipt('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.pdf')).toBeNull()
    expect(await receipt('../.env.local')).toBeNull()
  })

  it('logs and throws a short message when the query fails', async () => {
    vi.mocked(getMembership).mockResolvedValue({
      status: 'member',
      member: memberOf('not-a-uuid'),
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(receipt(pdfKey)).rejects.toThrow('Failed to load the receipt')
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/expenses',
    })
    consoleError.mockRestore()
  })
})
