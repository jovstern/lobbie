import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireMember } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { buildingMembers, buildings, user } from '@/app/lib/schema'
import { me } from './users'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/authz', () => ({ requireMember: vi.fn() }))
afterAll(() => testDb.close())

function signInAs(userId: string, buildingId: string) {
  const member: Member = {
    userId,
    buildingId,
    role: 'resident',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireMember).mockResolvedValue(member)
}

let buildingId: string
let otherBuildingId: string
let danaId: string
let benId: string

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  const [building, other] = await db
    .insert(buildings)
    .values([
      { name: 'Test', address: 'Here 1', billingStartMonth: '2026-01' },
      { name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' },
    ])
    .returning()
  buildingId = building.id
  otherBuildingId = other.id
  const [dana, ben] = await db
    .insert(user)
    .values([
      { name: 'Dana Zur', email: 'dana@test.example', phone: '+972505550101', locale: 'en' },
      // A language the app does not know.
      { name: 'Ben Cohen', email: 'ben@test.example', phone: null, locale: 'fr' },
    ])
    .returning()
  danaId = dana.id
  benId = ben.id
  await db.insert(buildingMembers).values([
    {
      userId: danaId,
      buildingId,
      role: 'committee',
      showContact: true,
      committeeTitle: 'Treasurer',
      committeePhone: '+97235550101',
      committeeEmail: 'treasurer@test.example',
    },
    { userId: benId, buildingId: otherBuildingId },
  ])
}, 30_000)

describe('me', () => {
  it('reads the member’s own profile and building settings', async () => {
    signInAs(danaId, buildingId)

    expect(await me()).toEqual({
      name: 'Dana Zur',
      email: 'dana@test.example',
      phone: '+972505550101',
      locale: 'en',
      role: 'committee',
      showContact: true,
      committeeTitle: 'Treasurer',
      committeePhone: '+97235550101',
      committeeEmail: 'treasurer@test.example',
    })
  })

  it('reads an unknown language as Hebrew, and the defaults of a new member', async () => {
    signInAs(benId, otherBuildingId)

    expect(await me()).toEqual({
      name: 'Ben Cohen',
      email: 'ben@test.example',
      phone: null,
      locale: 'he',
      role: 'resident',
      showContact: false,
      committeeTitle: null,
      committeePhone: null,
      committeeEmail: null,
    })
  })

  it('reads nothing of a membership in another building', async () => {
    signInAs(benId, buildingId)

    await expect(me()).rejects.toThrow('Failed to load the profile')
  })
})
