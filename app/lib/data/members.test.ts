import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { apartmentResidents, apartments, buildings, user } from '@/app/lib/schema'
import { seed } from '@/scripts/seed'
import { memberForUser } from './members'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z') })
})

describe('memberForUser', () => {
  it('lists apartments in natural order: 2, then 10, then 11', async () => {
    const [demo] = await db.select().from(buildings).where(eq(buildings.isDemo, true))
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
