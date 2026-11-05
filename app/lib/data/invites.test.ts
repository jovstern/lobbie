import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { apartments, buildings, invites, rateLimits, user } from '@/app/lib/schema'
import { generateInviteCode, hashInviteCode } from '@/app/lib/utils/invite-code'
import { forApartment, preview, previewForVisitor } from './invites'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '10.0.0.9' }),
}))
afterAll(() => testDb.close())
// A fixed test secret for the invite hashes (never a real one).
vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-secret-for-invite-hashes')

const day = 24 * 60 * 60 * 1000
let buildingId: string
let otherBuildingId: string
let apartmentId: string
let otherApartmentId: string
let adminId: string

function signInAsAdminOf(id: string) {
  const member: Member = {
    userId: adminId,
    buildingId: id,
    role: 'admin',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireRole).mockResolvedValue(member)
}

async function invite(
  overrides: Partial<typeof invites.$inferInsert> = {},
  where = { apartmentId: () => apartmentId, buildingId: () => buildingId },
) {
  const code = generateInviteCode()
  const [row] = await db
    .insert(invites)
    .values({
      buildingId: where.buildingId(),
      apartmentId: where.apartmentId(),
      codeHash: hashInviteCode(code),
      createdBy: adminId,
      expiresAt: new Date(Date.now() + 14 * day),
      ...overrides,
    })
    .returning()
  return { code, row }
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
  const [admin] = await db
    .insert(user)
    .values({ name: 'Admin', email: 'a@test.example' })
    .returning()
  adminId = admin.id
  const [mine, theirs] = await db
    .insert(apartments)
    .values([
      { buildingId, number: '7', floor: 2 },
      { buildingId: otherBuildingId, number: '7', floor: 2 },
    ])
    .returning()
  apartmentId = mine.id
  otherApartmentId = theirs.id
})

describe('preview', () => {
  it('names the building and apartment of a usable invite, from the code as typed', async () => {
    const { code } = await invite()
    expect(await preview(`${code.slice(0, 5).toLowerCase()} - ${code.slice(5)}`)).toEqual({
      status: 'valid',
      buildingId,
      buildingName: 'Pomegranate 12',
      apartmentId,
      apartmentNumber: '7',
    })
  })

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ['full', { uses: 6 }],
    ['revoked', { revokedAt: new Date(), uses: 6 }],
  ] as const)('says when an invite is %s', async (status, overrides) => {
    const { code } = await invite(overrides)
    expect((await preview(code))?.status).toBe(status)
  })

  it('is null for an unknown or malformed code', async () => {
    expect(await preview(generateInviteCode())).toBeNull()
    expect(await preview('../../etc')).toBeNull()
    expect(await preview('')).toBeNull()
  })
})

describe('forApartment', () => {
  it('is the newest invite that still works, with its uses and expiry', async () => {
    await db.delete(invites)
    signInAsAdminOf(buildingId)
    expect(await forApartment(apartmentId)).toBeNull()

    await invite({ revokedAt: new Date() })
    await invite({ expiresAt: new Date(Date.now() - 1000) })
    await invite({ uses: 6 })
    expect(await forApartment(apartmentId)).toBeNull()

    const { row } = await invite({ uses: 2 })
    expect(await forApartment(apartmentId)).toEqual({
      id: row.id,
      uses: 2,
      maxUses: 6,
      expiresAt: row.expiresAt,
    })
  })

  it('shows nothing of another building, or for a malformed id', async () => {
    signInAsAdminOf(buildingId)
    await invite({}, { apartmentId: () => otherApartmentId, buildingId: () => otherBuildingId })
    expect(await forApartment(otherApartmentId)).toBeNull()
    expect(await forApartment('nope')).toBeNull()
  })
})

describe('previewForVisitor', () => {
  it('shows the rate-limited state after 60 pages of unknown codes, counting no hits', async () => {
    await db.delete(rateLimits)
    const { code } = await invite({ revokedAt: new Date() })
    for (let i = 0; i < 60; i++) {
      // A code that names an invite, whatever its state, never counts.
      expect((await previewForVisitor(code)).kind).toBe('looked-up')
      expect(await previewForVisitor(generateInviteCode())).toEqual({
        kind: 'looked-up',
        invite: null,
      })
    }

    const limited = await previewForVisitor(code)
    expect(limited.kind).toBe('rate-limited')
  })
})
