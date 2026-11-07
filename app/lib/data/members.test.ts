import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { apartmentResidents, apartments, buildingMembers, buildings, user } from '@/app/lib/schema'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { list, memberForUser } from './members'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/authz', () => ({ requireRole: vi.fn() }))
afterAll(() => testDb.close())

function signInAsAdminOf(buildingId: string) {
  const member: Member = {
    userId: 'not-read',
    buildingId,
    role: 'admin',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireRole).mockResolvedValue(member)
}

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z'), e2e: true })
}, 30_000)

describe('memberForUser', () => {
  it('lists apartments in natural order: 2, then 10, then 11', async () => {
    const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
    const [person] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'resident6@example.com'))
    const rows = await db
      .select({ id: apartments.id, number: apartments.number })
      .from(apartments)
      .where(and(eq(apartments.buildingId, demo.id), inArray(apartments.number, ['2', '10', '11'])))
    const idOf = new Map(rows.map((row) => [row.number, row.id]))
    // Inserted out of order, so the result cannot rely on insertion order either.
    await db.insert(apartmentResidents).values(
      ['11', '2', '10'].map((number) => ({
        userId: person.id,
        apartmentId: idOf.get(number) ?? '',
        isOwner: false,
      })),
    )

    const member = await memberForUser(person.id)

    const numberOf = new Map(rows.map((row) => [row.id, row.number]))
    // Apartment 7 is resident6's own.
    expect(member?.apartmentIds.map((id) => numberOf.get(id) ?? '7')).toEqual([
      '2',
      '7',
      '10',
      '11',
    ])
  })
})

describe('list', () => {
  let otherBuildingId: string

  // PGlite's migrations and seed can outlast the default 10 s on a busy machine.
  beforeAll(async () => {
    const [other] = await db
      .insert(buildings)
      .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
      .returning()
    otherBuildingId = other.id
    const [stranger] = await db
      .insert(user)
      .values({ name: 'Another Building Person', email: 'stranger@test.example' })
      .returning()
    const [apartment] = await db
      .insert(apartments)
      .values({ buildingId: other.id, number: '1', floor: 0 })
      .returning()
    await db.insert(buildingMembers).values({ userId: stranger.id, buildingId: other.id })
    await db.insert(apartmentResidents).values({ userId: stranger.id, apartmentId: apartment.id })
  }, 30_000)

  it('lists everyone in the building, by name, with role, title and apartments only', async () => {
    signInAsAdminOf(demoBuildingId)

    const people = await list('')

    expect(people).toHaveLength(19)
    expect(people.map((person) => person.email)).not.toContain('stranger@test.example')
    const names = people.map((person) => person.name.toLowerCase())
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    const chair = people.find((person) => person.email === 'committee1@example.com')
    // Exactly these fields: no phone, no contact settings.
    expect(chair).toEqual({
      userId: expect.any(String),
      name: 'דוד כהן',
      email: 'committee1@example.com',
      role: 'committee',
      committeeTitle: 'יו״ר',
      apartments: [{ id: expect.any(String), number: '2' }],
    })
  })

  it('asks for the admin role', async () => {
    signInAsAdminOf(demoBuildingId)
    vi.mocked(requireRole).mockClear()

    await list('')

    expect(requireRole).toHaveBeenCalledExactlyOnceWith('admin')
  })

  it('sorts each person’s apartments naturally: 2, 7, 10, 11', async () => {
    signInAsAdminOf(demoBuildingId)

    const person = (await list('')).find((p) => p.email === 'resident6@example.com')

    // The first test above gave resident6 apartments 11, 2 and 10 besides their own 7.
    expect(person?.apartments.map((apartment) => apartment.number)).toEqual(['2', '7', '10', '11'])
  })

  it('finds people by part of their name, in any case', async () => {
    signInAsAdminOf(otherBuildingId)

    expect((await list('building PER')).map((person) => person.email)).toEqual([
      'stranger@test.example',
    ])
  })

  it('finds the people of an apartment by its exact number, with all their apartments', async () => {
    signInAsAdminOf(demoBuildingId)

    const people = await list(' E2E-1 ')

    expect(people.map((person) => person.email)).toEqual(['e2e1@example.com'])
    expect(people[0].apartments.map((apartment) => apartment.number)).toEqual(['e2e-1'])
  })

  it('finds people by part of their email, in any case, like someone who has no name yet', async () => {
    signInAsAdminOf(otherBuildingId)
    const [newcomer] = await db
      .insert(user)
      .values({ name: '', email: 'newcomer@test.example' })
      .returning()
    await db.insert(buildingMembers).values({ userId: newcomer.id, buildingId: otherBuildingId })

    expect((await list('NEWCOMER@')).map((person) => person.email)).toEqual([
      'newcomer@test.example',
    ])
    // Sorted by the name as shown: their email, after "Another Building Person".
    expect((await list('')).map((person) => person.email)).toEqual([
      'stranger@test.example',
      'newcomer@test.example',
    ])
  })

  it('takes LIKE wildcards literally', async () => {
    signInAsAdminOf(demoBuildingId)

    expect(await list('%')).toEqual([])
    expect(await list('_')).toEqual([])
  })

  it('never finds anyone of another building', async () => {
    signInAsAdminOf(demoBuildingId)

    expect(await list('Another Building')).toEqual([])
  })
})
