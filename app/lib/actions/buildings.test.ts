import { desc, eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAdjustment,
  update,
  type AdjustmentFormState,
  type BuildingFormState,
} from '@/app/lib/actions/buildings'
import { balance } from '@/app/lib/data/ledger'
import { db } from '@/app/lib/db'
import { balanceAdjustments, buildings, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import type { Locale } from '@/i18n/routing'
import en from '@/messages/en.json'
import he from '@/messages/he.json'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/i18n/navigation', () => ({ redirect: vi.fn() }))
// Outside Next, `'use cache'` is an inert string and the cache functions only record calls.
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: Locale
    namespace: 'Authz' | 'BuildingErrors' | 'AdjustmentErrors' | 'Demo'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

let buildingId: string

async function signInAs(email: string) {
  const [found] = await db.select().from(user).where(eq(user.email, email))
  const now = new Date()
  const session: Session = {
    user: found,
    session: {
      id: 'session-id',
      userId: found.id,
      token: 'token',
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    },
  }
  vi.mocked(getSession).mockResolvedValue(session)
  return found
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const validDetails = {
  name: 'רחוב הרימון 12',
  address: 'הרימון 12, רמת גן',
  quorumPercent: '60',
  billingStartMonth: '2025-11',
}
const validAdjustment = { direction: 'out', amount: '120.50', reason: 'Bank fees' }

const noBuildingState: BuildingFormState = {}
const noAdjustmentState: AdjustmentFormState = {}

const buildingRow = async () =>
  (await db.select().from(buildings).where(eq(buildings.id, buildingId)))[0]
const adjustmentRows = () =>
  db
    .select()
    .from(balanceAdjustments)
    .where(eq(balanceAdjustments.buildingId, buildingId))
    .orderBy(desc(balanceAdjustments.createdAt))

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z') })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
}, 30_000)

beforeEach(() => {
  vi.mocked(updateTag).mockClear()
})

describe('update', () => {
  it.each(['resident1@example.com', 'committee1@example.com'])(
    'refuses %s, who is not an admin, and keeps what was typed',
    async (email) => {
      await signInAs(email)
      const before = await buildingRow()

      const state = await update('en', false, noBuildingState, form(validDetails))

      expect(state).toEqual({ values: validDetails, message: en.Authz.forbidden })
      expect(await buildingRow()).toEqual(before)
      expect(updateTag).not.toHaveBeenCalled()
    },
  )

  it('saves the details for an admin and updates the building tag', async () => {
    await signInAs('admin@example.com')

    const state = await update(
      'en',
      false,
      noBuildingState,
      form({ ...validDetails, name: '  Pomegranate 12  ' }),
    )

    expect(state).toMatchObject({
      values: { ...validDetails, name: 'Pomegranate 12' },
      message: null,
      savedAt: expect.any(Number),
    })
    expect(await buildingRow()).toMatchObject({
      name: 'Pomegranate 12',
      quorumPercent: 60,
      billingStartMonth: '2025-11',
    })
    expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
  })

  it.each([
    [{ name: 'x' }, 'name', en.BuildingErrors.name],
    [{ name: 'x'.repeat(81) }, 'name', en.BuildingErrors.name],
    [{ address: 'x'.repeat(161) }, 'address', en.BuildingErrors.address],
    [{ quorumPercent: '0' }, 'quorumPercent', en.BuildingErrors.quorumPercent],
    [{ quorumPercent: '101' }, 'quorumPercent', en.BuildingErrors.quorumPercent],
    [{ quorumPercent: '50.5' }, 'quorumPercent', en.BuildingErrors.quorumPercent],
    [{ quorumPercent: 'half' }, 'quorumPercent', en.BuildingErrors.quorumPercent],
    [{ billingStartMonth: '2025-13' }, 'billingStartMonth', en.BuildingErrors.billingStartMonth],
    [{ billingStartMonth: '11/2025' }, 'billingStartMonth', en.BuildingErrors.billingStartMonth],
  ])('rejects %j with a field error', async (change, field, message) => {
    await signInAs('admin@example.com')
    const before = await buildingRow()
    const fields = { ...validDetails, ...change }

    const state = await update('en', false, noBuildingState, form(fields))

    expect(state).toEqual({ values: fields, errors: { [field]: [message] }, message: null })
    expect(await buildingRow()).toEqual(before)
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await signInAs('admin@example.com')

    const state = await update('he', false, noBuildingState, form({ ...validDetails, name: '' }))

    expect(state.errors?.name).toEqual([he.BuildingErrors.name])
  })

  it('refuses a demo building', async () => {
    await signInAs('admin@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))
    const before = await buildingRow()

    try {
      const state = await update(
        'en',
        false,
        noBuildingState,
        form({ ...validDetails, name: 'Changed' }),
      )

      expect(state.message).toBe(en.Demo.readOnly)
      expect(await buildingRow()).toEqual(before)
      expect(updateTag).not.toHaveBeenCalled()
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, buildingId))
    }
  })
})

describe('update, billing start month', () => {
  const moved = { ...validDetails, billingStartMonth: '2026-01' }

  it('asks to confirm a new month and saves nothing yet', async () => {
    await signInAs('admin@example.com')
    const before = await buildingRow()

    const state = await update('en', false, noBuildingState, form(moved))

    expect(state).toEqual({
      values: moved,
      message: null,
      confirmBillingChange: { from: '2025-11', to: '2026-01' },
    })
    expect(await buildingRow()).toEqual(before)
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('saves the new month once confirmed', async () => {
    await signInAs('admin@example.com')

    const state = await update('en', true, noBuildingState, form(moved))

    expect(state.savedAt).toEqual(expect.any(Number))
    expect(state.confirmBillingChange).toBeUndefined()
    expect((await buildingRow()).billingStartMonth).toBe('2026-01')
    expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)

    await update('en', true, noBuildingState, form(validDetails))
  })
})

describe('addAdjustment', () => {
  it.each(['resident1@example.com', 'committee2@example.com'])(
    'refuses %s, who is not an admin',
    async (email) => {
      await signInAs(email)

      const state = await addAdjustment('en', noAdjustmentState, form(validAdjustment))

      expect(state).toEqual({ values: validAdjustment, message: en.Authz.forbidden })
      expect(await adjustmentRows()).toEqual([])
      expect(updateTag).not.toHaveBeenCalled()
    },
  )

  it.each([
    [{ amount: '0' }, 'amount', en.AdjustmentErrors.amount],
    [{ amount: '0.00' }, 'amount', en.AdjustmentErrors.amount],
    [{ amount: '' }, 'amount', en.AdjustmentErrors.amount],
    [{ amount: '-50' }, 'amount', en.AdjustmentErrors.amount],
    [{ amount: '12.345' }, 'amount', en.AdjustmentErrors.amount],
    [{ direction: '' }, 'direction', en.AdjustmentErrors.direction],
    [{ direction: 'sideways' }, 'direction', en.AdjustmentErrors.direction],
    [{ reason: ' ab ' }, 'reason', en.AdjustmentErrors.reason],
    [{ reason: 'x'.repeat(201) }, 'reason', en.AdjustmentErrors.reason],
  ])('rejects %j with a field error', async (change, field, message) => {
    await signInAs('admin@example.com')
    const fields = { ...validAdjustment, ...change }

    const state = await addAdjustment('en', noAdjustmentState, form(fields))

    expect(state).toEqual({ values: fields, errors: { [field]: [message] }, message: null })
    expect(await adjustmentRows()).toEqual([])
  })

  it('refuses a demo building', async () => {
    await signInAs('admin@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    try {
      const state = await addAdjustment('en', noAdjustmentState, form(validAdjustment))

      expect(state.message).toBe(en.Demo.readOnly)
      expect(await adjustmentRows()).toEqual([])
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, buildingId))
    }
  })

  it('records money out as a negative amount, by the admin, and it moves the balance', async () => {
    const admin = await signInAs('admin@example.com')
    const before = await balance(buildingId)

    const state = await addAdjustment('en', noAdjustmentState, form(validAdjustment))

    expect(state).toEqual({ added: true, message: null })
    expect(await adjustmentRows()).toEqual([
      expect.objectContaining({
        amountAgorot: -12_050,
        reason: 'Bank fees',
        recordedBy: admin.id,
      }),
    ])
    expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
    expect(await balance(buildingId)).toEqual({
      ...before,
      adjustmentsAgorot: before.adjustmentsAgorot - 12_050,
      totalAgorot: before.totalAgorot - 12_050,
    })
  })

  it('records money in as a positive amount', async () => {
    await signInAs('admin@example.com')

    await addAdjustment(
      'en',
      noAdjustmentState,
      form({ direction: 'in', amount: '1,000', reason: 'Interest' }),
    )

    const [latest] = await adjustmentRows()
    expect(latest).toMatchObject({ amountAgorot: 100_000, reason: 'Interest' })
  })
})
