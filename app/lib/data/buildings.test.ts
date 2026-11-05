import { eq } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { balanceAdjustments, buildings, user } from '@/app/lib/schema'
import { demoBuildingId, demoBuildingName } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { adjustments, get } from './buildings'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record tags.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
afterAll(() => testDb.close())

let buildingId: string

function signInAsAdminOf(id: string) {
  const member: Member = {
    userId: 'not-read',
    buildingId: id,
    role: 'admin',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireRole).mockResolvedValue(member)
}

beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z') })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
  const [admin] = await db.select().from(user).where(eq(user.email, 'admin@example.com'))
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()

  await db.insert(balanceAdjustments).values([
    {
      buildingId,
      amountAgorot: -5_000,
      reason: 'older',
      recordedBy: admin.id,
      createdAt: new Date('2026-10-01T09:00:00Z'),
    },
    {
      buildingId,
      amountAgorot: 7_500,
      reason: 'newer',
      recordedBy: admin.id,
      createdAt: new Date('2026-10-20T09:00:00Z'),
    },
    { buildingId: other.id, amountAgorot: 100, reason: 'elsewhere', recordedBy: admin.id },
  ])
})

describe('get', () => {
  it("is the admin's own building, cached under its tag", async () => {
    signInAsAdminOf(buildingId)

    expect(await get()).toEqual({
      name: demoBuildingName,
      address: 'הרימון 12, רמת גן',
      quorumPercent: 50,
      billingStartMonth: '2025-11',
      openingBalanceAgorot: 850_000,
    })
    expect(requireRole).toHaveBeenCalledWith('admin')
    expect(cacheTag).toHaveBeenCalledWith(`building:${buildingId}`)
  })

  it('logs and throws a short message for a missing building', async () => {
    signInAsAdminOf('00000000-0000-4000-8000-000000000000')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(get()).rejects.toThrow('Failed to load the building')
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'data/buildings',
    })
    consoleError.mockRestore()
  })
})

describe('adjustments', () => {
  it("lists only the admin's building, newest first, with who recorded each", async () => {
    signInAsAdminOf(buildingId)

    const rows = await adjustments()

    expect(requireRole).toHaveBeenCalledWith('admin')
    expect(
      rows.map(({ reason, amountAgorot, recordedByName }) => ({
        reason,
        amountAgorot,
        recordedByName,
      })),
    ).toEqual([
      { reason: 'newer', amountAgorot: 7_500, recordedByName: 'מיכל אברהם' },
      { reason: 'older', amountAgorot: -5_000, recordedByName: 'מיכל אברהם' },
    ])
  })
})
