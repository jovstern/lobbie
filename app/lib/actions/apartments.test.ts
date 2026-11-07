import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { create, remove, update, type ApartmentFormState } from '@/app/lib/actions/apartments'
import { db } from '@/app/lib/db'
import {
  apartmentResidents,
  apartments,
  buildings,
  feeRates,
  payments,
  user,
} from '@/app/lib/schema'
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
vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: Locale
    namespace: 'Authz' | 'ApartmentErrors' | 'ApartmentBlockers' | 'Demo'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

const tEn = createTranslator({ locale: 'en', messages: en })

let otherBuildingId: string
let otherApartmentId: string
let adminId: string

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

const empty: ApartmentFormState = {}

async function apartmentNumbered(number: string, buildingId = demoBuildingId) {
  const [row] = await db
    .select()
    .from(apartments)
    .where(and(eq(apartments.buildingId, buildingId), eq(apartments.number, number)))
  return row
}

/** A new, empty apartment of the demo building, for a test to change or remove. */
async function freshApartment(number: string, billingStartMonth: string | null = null) {
  const [row] = await db
    .insert(apartments)
    .values({ buildingId: demoBuildingId, number, floor: 4, billingStartMonth })
    .returning()
  return row
}

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z') })
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  otherBuildingId = other.id
  const [otherApartment] = await db
    .insert(apartments)
    .values({ buildingId: other.id, number: '1', floor: 0 })
    .returning()
  otherApartmentId = otherApartment.id
  const [admin] = await db.select().from(user).where(eq(user.email, 'admin@example.com'))
  adminId = admin.id
}, 30_000)

beforeEach(() => {
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
})

describe('authorization', () => {
  it.each(['resident1@example.com', 'committee1@example.com'])(
    'refuses %s, who is not an admin, for every action',
    async (email) => {
      await signInAs(email)
      const target = await freshApartment(`auth-${email.slice(0, 4)}`)
      const fields = { number: '99', floor: '1', billingStartMonth: '' }

      expect(await create('en', empty, form(fields))).toEqual({
        values: fields,
        message: en.Authz.forbidden,
      })
      expect(await update('en', target.id, true, empty, form(fields))).toEqual({
        values: fields,
        message: en.Authz.forbidden,
      })
      expect(await remove('en', target.id)).toEqual({
        message: en.Authz.forbidden,
      })

      expect(await apartmentNumbered('99')).toBeUndefined()
      expect(await apartmentNumbered(target.number)).toEqual(target)
      expect(updateTag).not.toHaveBeenCalled()
    },
  )

  it("refuses another building's apartment, as if it did not exist", async () => {
    await signInAs('admin@example.com')
    const fields = { number: '1', floor: '3', billingStartMonth: '' }

    expect(await update('en', otherApartmentId, true, empty, form(fields))).toEqual({
      values: fields,
      message: en.ApartmentErrors.notFound,
    })
    expect(await remove('en', otherApartmentId)).toEqual({
      message: en.ApartmentErrors.notFound,
    })

    const [untouched] = await db
      .select()
      .from(apartments)
      .where(eq(apartments.id, otherApartmentId))
    expect(untouched).toMatchObject({ number: '1', floor: 0 })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('treats a malformed id as no apartment', async () => {
    await signInAs('admin@example.com')
    const fields = { number: '1', floor: '3', billingStartMonth: '' }

    expect((await update('en', 'nope', true, empty, form(fields))).message).toBe(
      en.ApartmentErrors.notFound,
    )
    expect((await remove('en', 'nope')).message).toBe(en.ApartmentErrors.notFound)
  })

  it('refuses every write in a demo building', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('demo-1')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))

    try {
      const fields = { number: 'demo-2', floor: '1', billingStartMonth: '' }
      expect((await create('en', empty, form(fields))).message).toBe(en.Demo.readOnly)
      expect((await update('en', target.id, true, empty, form(fields))).message).toBe(
        en.Demo.readOnly,
      )
      expect((await remove('en', target.id)).message).toBe(en.Demo.readOnly)

      expect(await apartmentNumbered('demo-2')).toBeUndefined()
      expect(await apartmentNumbered('demo-1')).toEqual(target)
      expect(updateTag).not.toHaveBeenCalled()
    } finally {
      await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, demoBuildingId))
    }
  })
})

describe('create', () => {
  it('adds the apartment to the admin’s building, trimmed, and refreshes its pages', async () => {
    await signInAs('admin@example.com')

    const state = await create(
      'en',
      empty,
      form({ number: '  14A ', floor: ' -2 ', billingStartMonth: '' }),
    )

    expect(state).toEqual({ saved: { number: '14A' }, message: null })
    expect(await apartmentNumbered('14A')).toMatchObject({ floor: -2, billingStartMonth: null })
    expect(updateTag).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments', 'page')
  })

  it('keeps its own billing start month', async () => {
    await signInAs('admin@example.com')

    await create('en', empty, form({ number: '15', floor: '5', billingStartMonth: '2026-04' }))

    expect(await apartmentNumbered('15')).toMatchObject({ billingStartMonth: '2026-04' })
  })

  it.each([
    [{ number: '' }, 'number', en.ApartmentErrors.number],
    [{ number: '   ' }, 'number', en.ApartmentErrors.number],
    [{ number: 'x'.repeat(11) }, 'number', en.ApartmentErrors.number],
    [{ floor: '' }, 'floor', en.ApartmentErrors.floor],
    [{ floor: '-6' }, 'floor', en.ApartmentErrors.floor],
    [{ floor: '201' }, 'floor', en.ApartmentErrors.floor],
    [{ floor: '1.5' }, 'floor', en.ApartmentErrors.floor],
    [{ floor: '1e2' }, 'floor', en.ApartmentErrors.floor],
    [{ floor: 'two' }, 'floor', en.ApartmentErrors.floor],
    [{ billingStartMonth: '2026-13' }, 'billingStartMonth', en.ApartmentErrors.billingStartMonth],
    [{ billingStartMonth: '04/2026' }, 'billingStartMonth', en.ApartmentErrors.billingStartMonth],
  ])('rejects %j with a field error and keeps what was typed', async (change, field, message) => {
    await signInAs('admin@example.com')
    const fields = { number: 'v-1', floor: '1', billingStartMonth: '', ...change }

    const state = await create('en', empty, form(fields))

    expect(state).toEqual({ values: fields, errors: { [field]: [message] }, message: null })
    expect(await apartmentNumbered('v-1')).toBeUndefined()
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await signInAs('admin@example.com')

    const state = await create('he', empty, form({ number: '', floor: '1', billingStartMonth: '' }))

    expect(state.errors?.number).toEqual([he.ApartmentErrors.number])
  })

  it('turns a number the building already has into a field error', async () => {
    await signInAs('admin@example.com')
    const fields = { number: '7', floor: '9', billingStartMonth: '' }

    const state = await create('en', empty, form(fields))

    expect(state).toEqual({
      values: fields,
      errors: { number: [tEn('ApartmentErrors.duplicate', { number: '7' })] },
      message: null,
    })
    expect(state.errors?.number).toEqual(['Apartment 7 already exists.'])
    expect(await apartmentNumbered('7')).toMatchObject({ floor: 3 })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('allows a number only another building uses', async () => {
    await signInAs('admin@example.com')
    await db
      .insert(apartments)
      .values({ buildingId: otherBuildingId, number: 'only-there', floor: 0 })

    const state = await create(
      'en',
      empty,
      form({ number: 'only-there', floor: '0', billingStartMonth: '' }),
    )

    expect(state.saved).toEqual({ number: 'only-there' })
  })
})

describe('update', () => {
  it('saves the number and floor of an apartment of the building', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('u-1')

    const state = await update(
      'en',
      target.id,
      false,
      empty,
      form({ number: 'u-1b', floor: '6', billingStartMonth: '' }),
    )

    expect(state).toEqual({ saved: { number: 'u-1b' }, message: null })
    expect(await apartmentNumbered('u-1b')).toMatchObject({ id: target.id, floor: 6 })
    expect(updateTag).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
    // A billing start changes the months the payments grid shows as owed.
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/payments', 'page')
  })

  it('turns a number another apartment has into a field error', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('u-2')
    const fields = { number: '3', floor: '4', billingStartMonth: '' }

    const state = await update('en', target.id, false, empty, form(fields))

    expect(state).toEqual({
      values: fields,
      errors: { number: ['Apartment 3 already exists.'] },
      message: null,
    })
    expect(await apartmentNumbered('u-2')).toEqual(target)
  })

  it('keeps its own number without a conflict', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('u-3')

    const state = await update(
      'en',
      target.id,
      false,
      empty,
      form({ number: 'u-3', floor: '7', billingStartMonth: '' }),
    )

    expect(state.saved).toEqual({ number: 'u-3' })
  })

  it('validates like create', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('u-4')
    const fields = { number: 'u-4', floor: '300', billingStartMonth: '' }

    expect(await update('en', target.id, false, empty, form(fields))).toEqual({
      values: fields,
      errors: { floor: [en.ApartmentErrors.floor] },
      message: null,
    })
  })
})

describe('update, billing start month', () => {
  it.each([
    ['b-1', null, '2026-03'],
    ['b-2', '2026-01', '2026-03'],
    ['b-3', '2026-01', null],
  ])(
    '%s: asks before changing it from %s to %s, then saves once confirmed',
    async (number, from, to) => {
      await signInAs('admin@example.com')
      const target = await freshApartment(number, from)
      const fields = { number: target.number, floor: '4', billingStartMonth: to ?? '' }

      const asked = await update('en', target.id, false, empty, form(fields))

      expect(asked).toEqual({ values: fields, message: null, confirmBillingChange: { from, to } })
      expect(await apartmentNumbered(target.number)).toEqual(target)
      expect(updateTag).not.toHaveBeenCalled()

      const confirmed = await update('en', target.id, true, empty, form(fields))

      expect(confirmed).toEqual({ saved: { number: target.number }, message: null })
      expect(await apartmentNumbered(target.number)).toMatchObject({ billingStartMonth: to })
      expect(updateTag).not.toHaveBeenCalled()
    },
  )

  it('saves without asking when the month stays', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('b-same', '2026-02')

    const state = await update(
      'en',
      target.id,
      false,
      empty,
      form({ number: 'b-same', floor: '8', billingStartMonth: '2026-02' }),
    )

    expect(state.saved).toEqual({ number: 'b-same' })
    expect(await apartmentNumbered('b-same')).toMatchObject({ floor: 8 })
  })
})

describe('remove', () => {
  it('removes an apartment nothing points at', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('r-empty')

    const state = await remove('en', target.id)

    expect(state).toEqual({ removed: true, message: null })
    expect(await apartmentNumbered('r-empty')).toBeUndefined()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('is blocked while people live in it, saying how many to move', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('r-people')
    const [first, second] = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, ['resident1@example.com', 'resident2@example.com']))
    await db.insert(apartmentResidents).values([
      { userId: first.id, apartmentId: target.id },
      { userId: second.id, apartmentId: target.id },
    ])

    const state = await remove('en', target.id)

    expect(state).toEqual({
      message: `${en.ApartmentErrors.blocked} Move or remove its 2 residents first.`,
    })
    expect(await apartmentNumbered('r-people')).toEqual(target)
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('is blocked by payment history, voided payments included', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('r-paid')
    await db.insert(payments).values({
      buildingId: demoBuildingId,
      apartmentId: target.id,
      month: '2026-10',
      amountAgorot: 10_000,
      paidOn: '2026-10-05',
      method: 'cash',
      recordedBy: adminId,
      voidedAt: new Date('2026-10-06T08:00:00Z'),
      voidedBy: adminId,
      voidReason: 'Recorded twice',
    })

    const state = await remove('en', target.id)

    expect(state).toEqual({
      message: `${en.ApartmentErrors.blocked} ${en.ApartmentBlockers.payments}`,
    })
    expect(await apartmentNumbered('r-paid')).toEqual(target)
  })

  it('is blocked by its own fee history', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('r-fee')
    await db.insert(feeRates).values({
      buildingId: demoBuildingId,
      apartmentId: target.id,
      amountAgorot: 30_000,
      effectiveFrom: '2026-01',
      createdBy: adminId,
    })

    const state = await remove('en', target.id)

    expect(state).toEqual({
      message: `${en.ApartmentErrors.blocked} ${en.ApartmentBlockers.feeOverrides}`,
    })
    expect(await apartmentNumbered('r-fee')).toEqual(target)
  })

  it('says the apartment is gone when it was already removed', async () => {
    await signInAs('admin@example.com')
    const target = await freshApartment('r-twice')
    await remove('en', target.id)

    expect(await remove('en', target.id)).toEqual({
      message: en.ApartmentErrors.notFound,
    })
  })
})
