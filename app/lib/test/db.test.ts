import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { buildings } from '@/app/lib/schema'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

describe('createTestDb', () => {
  it('stands in for the app database, migrated, with generated uuids', async () => {
    const [created] = await db
      .insert(buildings)
      .values({ name: 'Test', address: 'Somewhere 1', billingStartMonth: '2026-01' })
      .returning()

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    const found = await db.select().from(buildings).where(eq(buildings.id, created.id))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ timezone: 'Asia/Jerusalem', quorumPercent: 50 })
  })
})
