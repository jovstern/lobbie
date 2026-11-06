import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import {
  apartmentResidents,
  apartments,
  buildings,
  feeRates,
  invites,
  payments,
  user,
} from '@/app/lib/schema'
import { get, list, residentsOf } from './apartments'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
afterAll(() => testDb.close())

let buildingId: string
let otherBuildingId: string
const ids = new Map<string, string>()

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
  const [building, other] = await db
    .insert(buildings)
    .values([
      { name: 'Pomegranate 12', address: 'Here 1', billingStartMonth: '2026-01' },
      { name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' },
    ])
    .returning()
  buildingId = building.id
  otherBuildingId = other.id
  const [admin, neighbour] = await db
    .insert(user)
    .values([
      { name: 'Admin', email: 'admin@test.example' },
      { name: 'Neighbour', email: 'neighbour@test.example' },
    ])
    .returning()

  // Inserted out of order, so the sort is the query's.
  const saved = await db
    .insert(apartments)
    .values([
      { buildingId, number: '10', floor: 2 },
      { buildingId, number: '2A', floor: 2 },
      { buildingId, number: '10A', floor: 2 },
      { buildingId, number: 'C', floor: 2 },
      { buildingId, number: '2', floor: 2, billingStartMonth: '2026-03' },
      { buildingId, number: '1', floor: 1 },
      { buildingId, number: 'B1', floor: -1 },
      { buildingId: otherBuildingId, number: '1', floor: 0 },
    ])
    .returning()
  for (const row of saved) {
    if (row.buildingId === buildingId) ids.set(row.number, row.id)
  }
  const apartment = (number: string) => ids.get(number) ?? ''

  await db.insert(apartmentResidents).values([
    { userId: admin.id, apartmentId: apartment('1') },
    { userId: neighbour.id, apartmentId: apartment('1') },
  ])
  await db.insert(payments).values(
    ['2026-01', '2026-02'].map((month) => ({
      buildingId,
      apartmentId: apartment('2'),
      month,
      amountAgorot: 10_000,
      paidOn: `${month}-05`,
      method: 'cash' as const,
      recordedBy: admin.id,
    })),
  )
  await db.insert(feeRates).values([
    // The building default is no apartment's override.
    { buildingId, amountAgorot: 10_000, effectiveFrom: '2026-01', createdBy: admin.id },
    {
      buildingId,
      apartmentId: apartment('10'),
      amountAgorot: 15_000,
      effectiveFrom: '2026-01',
      createdBy: admin.id,
    },
  ])
  // Only C's first invite still works: revoked, expired and used-up ones do not count.
  const day = 24 * 60 * 60 * 1000
  await db.insert(invites).values(
    [{}, { revokedAt: new Date() }, { expiresAt: new Date(Date.now() - day) }, { uses: 6 }].map(
      (state, i) => ({
        buildingId,
        apartmentId: apartment('C'),
        codeHash: `hash-${i}`,
        createdBy: admin.id,
        expiresAt: new Date(Date.now() + day),
        ...state,
      }),
    ),
  )
})

describe('list', () => {
  it('is the building’s apartments by floor, then naturally by number', async () => {
    signInAsAdminOf(buildingId)

    expect((await list()).map(({ floor, number }) => `${floor}:${number}`)).toEqual([
      '-1:B1',
      '1:1',
      '2:2',
      '2:2A',
      '2:10',
      '2:10A',
      '2:C',
    ])
  })

  it('counts what points at each apartment', async () => {
    signInAsAdminOf(buildingId)
    const byNumber = new Map((await list()).map((apartment) => [apartment.number, apartment]))

    expect(byNumber.get('B1')).toEqual({
      id: ids.get('B1'),
      number: 'B1',
      floor: -1,
      billingStartMonth: null,
      residents: 0,
      activeInvites: 0,
      payments: 0,
      feeOverrides: 0,
    })
    expect(byNumber.get('C')).toMatchObject({ residents: 0, activeInvites: 1 })
    expect(byNumber.get('1')).toMatchObject({ residents: 2, payments: 0, feeOverrides: 0 })
    expect(byNumber.get('2')).toMatchObject({
      billingStartMonth: '2026-03',
      residents: 0,
      payments: 2,
      feeOverrides: 0,
    })
    expect(byNumber.get('10')).toMatchObject({ residents: 0, payments: 0, feeOverrides: 1 })
    expect(requireRole).toHaveBeenCalledWith('admin')
  })

  it('sends one query for every apartment and its counts', async () => {
    signInAsAdminOf(buildingId)
    const query = vi.spyOn(testDb.client, 'query')

    try {
      await list()
      expect(query).toHaveBeenCalledTimes(1)
    } finally {
      query.mockRestore()
    }
  })

  it('is only the other building’s apartments for its admin', async () => {
    signInAsAdminOf(otherBuildingId)

    expect((await list()).map((apartment) => apartment.number)).toEqual(['1'])
  })
})

describe('get', () => {
  it('asks for the admin role', async () => {
    signInAsAdminOf(buildingId)
    vi.mocked(requireRole).mockClear()

    await get(ids.get('2') ?? '')

    expect(requireRole).toHaveBeenCalledExactlyOnceWith('admin')
  })

  it('is an apartment of the admin’s building', async () => {
    signInAsAdminOf(buildingId)

    expect(await get(ids.get('2') ?? '')).toEqual({
      id: ids.get('2'),
      number: '2',
      floor: 2,
      billingStartMonth: '2026-03',
    })
  })

  it('is null for another building’s apartment, an unknown id and a malformed one', async () => {
    signInAsAdminOf(otherBuildingId)

    expect(await get(ids.get('2') ?? '')).toBeNull()
    expect(await get('00000000-0000-4000-8000-000000000000')).toBeNull()
    expect(await get('not-a-uuid')).toBeNull()
  })

  it('reads nothing when the role check fails', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('NEXT_HTTP_ERROR_FALLBACK;404'))
    const query = vi.spyOn(testDb.client, 'query')

    try {
      await expect(get(ids.get('2') ?? '')).rejects.toThrow('404')
      expect(query).not.toHaveBeenCalled()
    } finally {
      query.mockRestore()
    }
  })
})

describe('residentsOf', () => {
  it('is the apartment’s residents by name, each with how many apartments they live in', async () => {
    signInAsAdminOf(buildingId)
    const [admin] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'admin@test.example'))
    // The admin also lives in 2A, and owns 1.
    await db
      .insert(apartmentResidents)
      .values({ userId: admin.id, apartmentId: ids.get('2A') ?? '' })
    await db
      .update(apartmentResidents)
      .set({ isOwner: true })
      .where(
        and(
          eq(apartmentResidents.userId, admin.id),
          eq(apartmentResidents.apartmentId, ids.get('1') ?? ''),
        ),
      )

    expect(await residentsOf(ids.get('1') ?? '')).toEqual([
      {
        userId: admin.id,
        name: 'Admin',
        email: 'admin@test.example',
        isOwner: true,
        apartmentCount: 2,
      },
      {
        userId: expect.any(String),
        name: 'Neighbour',
        email: 'neighbour@test.example',
        isOwner: false,
        apartmentCount: 1,
      },
    ])
    expect(requireRole).toHaveBeenCalledWith('admin')
  })

  it('is nobody for an empty apartment', async () => {
    signInAsAdminOf(buildingId)

    expect(await residentsOf(ids.get('B1') ?? '')).toEqual([])
  })

  it('is nobody for another building’s apartment, or a malformed id', async () => {
    signInAsAdminOf(otherBuildingId)

    expect(await residentsOf(ids.get('1') ?? '')).toEqual([])
    expect(await residentsOf('not-a-uuid')).toEqual([])
  })

  it('sends one query', async () => {
    signInAsAdminOf(buildingId)
    const query = vi.spyOn(testDb.client, 'query')

    try {
      await residentsOf(ids.get('1') ?? '')
      expect(query).toHaveBeenCalledTimes(1)
    } finally {
      query.mockRestore()
    }
  })
})
