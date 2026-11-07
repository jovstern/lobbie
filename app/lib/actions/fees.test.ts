import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { followBuilding, setDefault, setOverride, type FeeFormState } from '@/app/lib/actions/fees'
import { db } from '@/app/lib/db'
import { apartments, buildings, feeRates, user } from '@/app/lib/schema'
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
    namespace: 'Authz' | 'FeeErrors' | 'Demo'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// The seed starts billing 12 months before "now": November 2025, for a now in November 2026.
const now = new Date('2026-11-02T10:00:00Z')
const errors = createTranslator({ locale: 'en', messages: en, namespace: 'FeeErrors' })

let buildingId: string
let otherApartmentId: string
const apartmentIds = new Map<string, string>()

const idOf = (number: string) => {
  const id = apartmentIds.get(number)
  if (id === undefined) throw new Error(`no apartment ${number}`)
  return id
}

async function signInAs(email: string) {
  const [found] = await db.select().from(user).where(eq(user.email, email))
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

const noState: FeeFormState = {}

/** The building's rates of one kind (null: the default), oldest first. */
const ratesOf = (apartmentId: string | null) =>
  db
    .select({
      amountAgorot: feeRates.amountAgorot,
      effectiveFrom: feeRates.effectiveFrom,
      createdBy: feeRates.createdBy,
    })
    .from(feeRates)
    .where(
      and(
        eq(feeRates.buildingId, buildingId),
        apartmentId === null ? isNull(feeRates.apartmentId) : eq(feeRates.apartmentId, apartmentId),
      ),
    )
    .orderBy(feeRates.effectiveFrom)

const seededDefault = { amountAgorot: 35_000, effectiveFrom: '2025-11' }

beforeAll(async () => {
  await seed(db, { now })
  const [demo] = await db.select().from(buildings).where(eq(buildings.id, demoBuildingId))
  buildingId = demo.id
  const rows = await db
    .select({ id: apartments.id, number: apartments.number })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
  for (const row of rows) apartmentIds.set(row.number, row.id)

  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  const [elsewhere] = await db
    .insert(apartments)
    .values({ buildingId: other.id, number: '1', floor: 1 })
    .returning()
  otherApartmentId = elsewhere.id
})

beforeEach(() => {
  // Only Date: the database client keeps its real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
})

afterEach(async () => {
  vi.useRealTimers()
  // Back to the seed's rates: its one default, and no fee of their own for 1 and 7.
  await db
    .delete(feeRates)
    .where(and(eq(feeRates.buildingId, buildingId), isNull(feeRates.apartmentId)))
  const [treasurer] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  await db.insert(feeRates).values({ buildingId, ...seededDefault, createdBy: treasurer.id })
  await db.delete(feeRates).where(inArray(feeRates.apartmentId, [idOf('1'), idOf('7')]))
  // Penthouse 10 keeps only the seed's own fee.
  await db
    .delete(feeRates)
    .where(and(eq(feeRates.apartmentId, idOf('10')), ne(feeRates.effectiveFrom, '2025-11')))
  await db
    .update(apartments)
    .set({ billingStartMonth: null })
    .where(eq(apartments.id, idOf('7')))
  await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, buildingId))
})

describe('setDefault', () => {
  const valid = { amount: '400', effectiveFrom: '2027-01' }

  it('refuses a resident and keeps what was typed', async () => {
    await signInAs('resident1@example.com')

    const state = await setDefault('en', noState, form(valid))

    expect(state).toEqual({ values: valid, message: en.Authz.forbidden })
    expect(await ratesOf(null)).toEqual([expect.objectContaining(seededDefault)])
    expect(updateTag).not.toHaveBeenCalled()
  })

  it.each(['committee1@example.com', 'admin@example.com'])(
    'sets a new fee from a month for %s, keeping the earlier one',
    async (email) => {
      const person = await signInAs(email)

      const state = await setDefault('en', noState, form({ ...valid, amount: ' 412.50 ' }))

      expect(state).toEqual({
        message: null,
        saved: { amountAgorot: 41_250, effectiveFrom: '2027-01', apartmentNumber: null },
      })
      expect(await ratesOf(null)).toEqual([
        expect.objectContaining(seededDefault),
        { amountAgorot: 41_250, effectiveFrom: '2027-01', createdBy: person.id },
      ])
      // The building's billing (fee rates) is cached under its tag.
      expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/fees', 'page')
    },
  )

  it('replaces the fee already set from the same month', async () => {
    const person = await signInAs('committee1@example.com')
    await setDefault('en', noState, form(valid))

    await setDefault('en', noState, form({ ...valid, amount: '380' }))

    const rates = await ratesOf(null)
    expect(rates).toHaveLength(2)
    expect(rates[1]).toEqual({
      amountAgorot: 38_000,
      effectiveFrom: '2027-01',
      createdBy: person.id,
    })
  })

  it.each([
    [{ amount: '0' }, 'amount', errors('amount')],
    [{ amount: '-50' }, 'amount', errors('amount')],
    [{ amount: 'lots' }, 'amount', errors('amount')],
    [{ amount: '' }, 'amount', errors('amount')],
    [{ effectiveFrom: '' }, 'effectiveFrom', errors('effectiveFrom')],
    [{ effectiveFrom: '2027-13' }, 'effectiveFrom', errors('effectiveFrom')],
    [{ effectiveFrom: '01/2027' }, 'effectiveFrom', errors('effectiveFrom')],
  ])('rejects %j with a field error', async (change, field, message) => {
    await signInAs('committee1@example.com')
    const fields = { ...valid, ...change }

    const state = await setDefault('en', noState, form(fields))

    expect(state).toEqual({ values: fields, errors: { [field]: [message] }, message: null })
    expect(await ratesOf(null)).toHaveLength(1)
  })

  it('rejects a month before the building starts billing', async () => {
    await signInAs('committee1@example.com')
    const fields = { ...valid, effectiveFrom: '2025-10' }

    const state = await setDefault('en', noState, form(fields))

    expect(state).toEqual({
      values: fields,
      errors: { effectiveFrom: [errors('beforeBillingStart', { month: 'November 2025' })] },
      message: null,
    })
    expect(await ratesOf(null)).toHaveLength(1)
  })

  it('rejects a past month once the building has a fee: earlier months keep theirs', async () => {
    await signInAs('committee1@example.com')
    const fields = { ...valid, effectiveFrom: '2026-10' }

    const state = await setDefault('en', noState, form(fields))

    expect(state).toEqual({
      values: fields,
      errors: { effectiveFrom: [errors('beforeCurrentMonth', { month: 'November 2026' })] },
      message: null,
    })
    expect(await ratesOf(null)).toEqual([expect.objectContaining(seededDefault)])
  })

  it("refuses to replace a past month's fee", async () => {
    await signInAs('committee1@example.com')

    const state = await setDefault('en', noState, form({ amount: '360', effectiveFrom: '2025-11' }))

    expect(state.errors).toEqual({
      effectiveFrom: [errors('beforeCurrentMonth', { month: 'November 2026' })],
    })
    expect(await ratesOf(null)).toEqual([expect.objectContaining(seededDefault)])
  })

  it('sets and then replaces a fee from the current month', async () => {
    await signInAs('committee1@example.com')

    const first = await setDefault('en', noState, form({ amount: '360', effectiveFrom: '2026-11' }))
    const second = await setDefault(
      'en',
      noState,
      form({ amount: '370', effectiveFrom: '2026-11' }),
    )

    expect(first.saved).toBeDefined()
    expect(second.saved?.amountAgorot).toBe(37_000)
    expect((await ratesOf(null)).map(({ amountAgorot }) => amountAgorot)).toEqual([
      seededDefault.amountAgorot,
      37_000,
    ])
  })

  it("lets the building's first fee start with billing, in the past", async () => {
    await signInAs('committee1@example.com')
    await db
      .delete(feeRates)
      .where(and(eq(feeRates.buildingId, buildingId), isNull(feeRates.apartmentId)))

    const state = await setDefault('en', noState, form({ amount: '360', effectiveFrom: '2025-11' }))

    expect(state.saved).toEqual({
      amountAgorot: 36_000,
      effectiveFrom: '2025-11',
      apartmentNumber: null,
    })
  })

  it('accepts a month up to a year ahead, and nothing later', async () => {
    await signInAs('committee1@example.com')

    expect(
      (await setDefault('en', noState, form({ ...valid, effectiveFrom: '2027-11' }))).saved,
    ).toBeDefined()
    const late = await setDefault('en', noState, form({ ...valid, effectiveFrom: '2027-12' }))

    expect(late.errors).toEqual({
      effectiveFrom: [errors('tooFarAhead', { month: 'November 2027' })],
    })
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await signInAs('committee1@example.com')

    const state = await setDefault('he', noState, form({ ...valid, amount: '0' }))

    expect(state.errors?.amount).toEqual([he.FeeErrors.amount])
  })

  it('refuses a demo building', async () => {
    await signInAs('committee1@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    const state = await setDefault('en', noState, form(valid))

    expect(state).toEqual({ values: valid, message: en.Demo.readOnly })
    expect(await ratesOf(null)).toHaveLength(1)
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('setOverride', () => {
  const valid = { amount: '420', effectiveFrom: '2027-01' }

  it('refuses a resident', async () => {
    await signInAs('resident1@example.com')

    const state = await setOverride('en', idOf('7'), noState, form(valid))

    expect(state.message).toBe(en.Authz.forbidden)
    expect(await ratesOf(idOf('7'))).toEqual([])
  })

  it("sets the bound apartment's own fee, for the committee", async () => {
    const person = await signInAs('committee1@example.com')

    const state = await setOverride('en', idOf('7'), noState, form(valid))

    expect(state).toEqual({
      message: null,
      saved: { amountAgorot: 42_000, effectiveFrom: '2027-01', apartmentNumber: '7' },
    })
    expect(await ratesOf(idOf('7'))).toEqual([
      { amountAgorot: 42_000, effectiveFrom: '2027-01', createdBy: person.id },
    ])
    // The building default of the same month is another rate: both stand.
    expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
  })

  it('takes the apartment from the form when none is bound', async () => {
    await signInAs('admin@example.com')

    const state = await setOverride('en', null, noState, form({ ...valid, apartmentId: idOf('1') }))

    expect(state.saved?.apartmentNumber).toBe('1')
    expect(await ratesOf(idOf('1'))).toHaveLength(1)
  })

  it('asks to choose an apartment when the form has none', async () => {
    await signInAs('committee1@example.com')

    const state = await setOverride('en', null, noState, form({ ...valid, apartmentId: '' }))

    expect(state).toEqual({
      values: { ...valid, apartmentId: '' },
      errors: { apartmentId: [errors('apartment')] },
      message: null,
    })
  })

  it.each([
    ['bound', () => otherApartmentId],
    ['bound, malformed', () => 'not-a-uuid'],
  ])("refuses another building's apartment (%s)", async (_, apartmentId) => {
    await signInAs('committee1@example.com')

    const state = await setOverride('en', apartmentId(), noState, form(valid))

    expect(state.message).toBe(errors('notFound'))
    expect(
      await db.select().from(feeRates).where(eq(feeRates.apartmentId, otherApartmentId)),
    ).toEqual([])
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("refuses another building's apartment chosen in the form", async () => {
    await signInAs('committee1@example.com')

    const state = await setOverride(
      'en',
      null,
      noState,
      form({ ...valid, apartmentId: otherApartmentId }),
    )

    expect(state.message).toBe(errors('notFound'))
    expect(
      await db.select().from(feeRates).where(eq(feeRates.apartmentId, otherApartmentId)),
    ).toEqual([])
  })

  it("rejects a month before the apartment's own billing start", async () => {
    await signInAs('committee1@example.com')
    await db
      .update(apartments)
      .set({ billingStartMonth: '2026-03' })
      .where(eq(apartments.id, idOf('7')))

    const state = await setOverride(
      'en',
      idOf('7'),
      noState,
      form({ ...valid, effectiveFrom: '2026-02' }),
    )

    expect(state.errors).toEqual({
      effectiveFrom: [errors('beforeBillingStart', { month: 'March 2026' })],
    })
    expect(await ratesOf(idOf('7'))).toEqual([])
  })

  it("uses the building's billing start for an apartment without its own", async () => {
    await signInAs('committee1@example.com')

    const before = await setOverride(
      'en',
      idOf('7'),
      noState,
      form({ ...valid, effectiveFrom: '2025-10' }),
    )
    const from = await setOverride(
      'en',
      idOf('7'),
      noState,
      form({ ...valid, effectiveFrom: '2025-11' }),
    )

    expect(before.errors).toEqual({
      effectiveFrom: [errors('beforeBillingStart', { month: 'November 2025' })],
    })
    expect(from.saved).toBeDefined()
  })

  it('rejects a past month once the apartment has a fee of its own', async () => {
    await signInAs('committee1@example.com')

    // Penthouse 10 has paid its own fee since billing started.
    const state = await setOverride(
      'en',
      idOf('10'),
      noState,
      form({ ...valid, effectiveFrom: '2026-10' }),
    )

    expect(state.errors).toEqual({
      effectiveFrom: [errors('beforeCurrentMonth', { month: 'November 2026' })],
    })
    expect(await ratesOf(idOf('10'))).toHaveLength(1)
  })

  it("does not count the building's fee against an apartment's first own fee", async () => {
    await signInAs('committee1@example.com')

    const state = await setOverride(
      'en',
      idOf('7'),
      noState,
      form({ ...valid, effectiveFrom: '2026-01' }),
    )

    expect(state.saved?.effectiveFrom).toBe('2026-01')
  })

  it('rejects an amount of zero', async () => {
    await signInAs('committee1@example.com')

    const state = await setOverride('en', idOf('7'), noState, form({ ...valid, amount: '0' }))

    expect(state.errors).toEqual({ amount: [errors('amount')] })
  })

  it('refuses a demo building', async () => {
    await signInAs('committee1@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    const state = await setOverride('en', idOf('7'), noState, form(valid))

    expect(state.message).toBe(en.Demo.readOnly)
    expect(await ratesOf(idOf('7'))).toEqual([])
  })
})

describe('followBuilding', () => {
  // Penthouse 10 has paid its own ₪450 since billing started (November 2025).
  const penthouse = () => idOf('10')

  it('refuses a resident', async () => {
    await signInAs('resident1@example.com')

    const state = await followBuilding('en', penthouse(), '2026-12')

    expect(state).toEqual({ message: en.Authz.forbidden })
    expect(await ratesOf(penthouse())).toHaveLength(1)
  })

  it.each(['committee1@example.com', 'admin@example.com'])(
    "ends the apartment's own fee from a month for %s, keeping its history",
    async (email) => {
      const person = await signInAs(email)

      const state = await followBuilding('en', penthouse(), '2026-12')

      expect(state).toEqual({ done: true, message: null })
      expect(await ratesOf(penthouse())).toEqual([
        { amountAgorot: 45_000, effectiveFrom: '2025-11', createdBy: expect.any(String) },
        { amountAgorot: null, effectiveFrom: '2026-12', createdBy: person.id },
      ])
      expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/fees', 'page')
    },
  )

  it('accepts the current month', async () => {
    await signInAs('committee1@example.com')

    expect(await followBuilding('en', penthouse(), '2026-11')).toEqual({
      done: true,
      message: null,
    })
  })

  it('refuses a month that has passed', async () => {
    await signInAs('committee1@example.com')

    const state = await followBuilding('en', penthouse(), '2026-10')

    expect(state).toEqual({
      message: errors('beforeCurrentMonth', { month: 'November 2026' }),
    })
    expect(await ratesOf(penthouse())).toHaveLength(1)
  })

  it('refuses a month more than a year ahead', async () => {
    await signInAs('committee1@example.com')

    const state = await followBuilding('en', penthouse(), '2027-12')

    expect(state.message).toBe(errors('tooFarAhead', { month: 'November 2027' }))
  })

  it('refuses a month before its latest own fee starts', async () => {
    await signInAs('committee1@example.com')
    await setOverride('en', penthouse(), noState, form({ amount: '480', effectiveFrom: '2027-02' }))

    const state = await followBuilding('en', penthouse(), '2027-01')

    expect(state.message).toBe(errors('beforeOwnFee', { month: 'February 2027' }))
  })

  it('refuses an apartment that already follows the building', async () => {
    await signInAs('committee1@example.com')

    const never = await followBuilding('en', idOf('7'), '2026-12')
    await followBuilding('en', penthouse(), '2026-12')
    const again = await followBuilding('en', penthouse(), '2027-01')

    expect(never.message).toBe(errors('noOwnFee', { number: '7' }))
    expect(again.message).toBe(errors('noOwnFee', { number: '10' }))
    expect(await ratesOf(idOf('7'))).toEqual([])
  })

  it('lets the apartment have its own fee again later', async () => {
    await signInAs('committee1@example.com')
    await followBuilding('en', penthouse(), '2026-12')

    const state = await setOverride(
      'en',
      penthouse(),
      noState,
      form({ amount: '500', effectiveFrom: '2027-03' }),
    )

    expect(state.saved?.amountAgorot).toBe(50_000)
  })

  it.each([
    ["another building's apartment", () => otherApartmentId],
    ['a malformed id', () => 'not-a-uuid'],
  ])('refuses %s', async (_, apartmentId) => {
    await signInAs('committee1@example.com')

    const state = await followBuilding('en', apartmentId(), '2026-12')

    expect(state.message).toBe(errors('notFound'))
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuses a malformed month', async () => {
    await signInAs('committee1@example.com')

    expect((await followBuilding('en', penthouse(), '12/2026')).message).toBe(
      errors('effectiveFrom'),
    )
  })

  it('refuses a demo building', async () => {
    await signInAs('committee1@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    const state = await followBuilding('en', penthouse(), '2026-12')

    expect(state.message).toBe(en.Demo.readOnly)
    expect(await ratesOf(penthouse())).toHaveLength(1)
  })
})
