import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  record,
  voidPayment,
  type PaymentFormState,
  type VoidPaymentState,
} from '@/app/lib/actions/payments'
import { forApartment } from '@/app/lib/data/payments'
import { db } from '@/app/lib/db'
import { apartments, buildings, payments, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
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
    namespace: 'Authz' | 'PaymentErrors' | 'Demo'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// The seed bills from 12 months before "now", at ₪350: November 2025 through November 2026.
// Apartment 4 has not paid October and November; apartment 1 has paid every month.
const now = new Date('2026-11-02T10:00:00Z')
const fee = 35_000
const errors = createTranslator({ locale: 'en', messages: en, namespace: 'PaymentErrors' })

let buildingId: string
let otherApartmentId: string
let otherPaymentId: string
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

type Fields = {
  months: readonly string[]
  amount: string
  paidOn: string
  method: string
  note: string
}

function form({ months, ...fields }: Fields) {
  const data = new FormData()
  for (const month of months) data.append('months', month)
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const noState: PaymentFormState = {}
const valid: Fields = {
  months: ['2026-10', '2026-11'],
  amount: '700',
  paidOn: '2026-11-02',
  method: 'bit',
  note: 'Paid at the door',
}

/** An apartment's payments that count (not voided), oldest month first. */
const countedOf = (number: string) =>
  db
    .select({
      month: payments.month,
      amountAgorot: payments.amountAgorot,
      paidOn: payments.paidOn,
      method: payments.method,
      note: payments.note,
      recordedBy: payments.recordedBy,
    })
    .from(payments)
    .where(and(eq(payments.apartmentId, idOf(number)), isNull(payments.voidedAt)))
    .orderBy(payments.month, payments.createdAt)

/** Apartment 4's payments for its two unpaid months, voided or not. */
const unpaidMonthPayments = () =>
  db
    .select()
    .from(payments)
    .where(
      and(eq(payments.apartmentId, idOf('4')), inArray(payments.month, ['2026-10', '2026-11'])),
    )

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
  const [someone] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  const [payment] = await db
    .insert(payments)
    .values({
      buildingId: other.id,
      apartmentId: elsewhere.id,
      month: '2026-10',
      amountAgorot: fee,
      paidOn: '2026-10-05',
      method: 'cash',
      recordedBy: someone.id,
    })
    .returning()
  otherPaymentId = payment.id
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
  // Back to the seed: apartment 4 owes October and November, and apartment 1 owes nothing.
  await db
    .delete(payments)
    .where(
      and(
        eq(payments.apartmentId, idOf('4')),
        inArray(payments.month, ['2025-10', '2026-10', '2026-11', '2026-12']),
      ),
    )
  await db
    .delete(payments)
    .where(
      and(eq(payments.apartmentId, idOf('1')), inArray(payments.month, ['2027-11', '2027-12'])),
    )
  await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, buildingId))
})

describe('record', () => {
  it('refuses a resident and keeps what was typed', async () => {
    await signInAs('resident1@example.com')

    const state = await record('en', idOf('4'), noState, form(valid))

    expect(state).toEqual({ values: valid, message: en.Authz.forbidden })
    expect(await unpaidMonthPayments()).toHaveLength(0)
  })

  it.each(['committee1@example.com', 'admin@example.com'])(
    'splits one payment over several months, one row per month, for %s',
    async (email) => {
      const person = await signInAs(email)

      const state = await record('en', idOf('4'), noState, form(valid))

      expect(state).toEqual({
        message: null,
        recorded: { apartmentNumber: '4', amountAgorot: 70_000, months: ['2026-10', '2026-11'] },
      })
      const rows = (await countedOf('4')).filter(({ month }) => month >= '2026-10')
      expect(rows).toEqual(
        ['2026-10', '2026-11'].map((month) => ({
          month,
          amountAgorot: fee,
          paidOn: '2026-11-02',
          method: 'bit',
          note: 'Paid at the door',
          recordedBy: person.id,
        })),
      )
      // The building's balance is cached under its tag.
      expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
      // The committee's overview and grid show who owes what.
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin', 'page')
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/payments', 'page')
    },
  )

  it('turns the apartment from overdue to paid', async () => {
    await signInAs('committee1@example.com')
    expect((await forApartment(idOf('4'), now))?.standing.kind).toBe('overdue')

    await record('en', idOf('4'), noState, form(valid))

    expect((await forApartment(idOf('4'), now))?.standing).toEqual({ kind: 'paid' })
  })

  it('records part of a month, then refuses more than is left of it, saying how much', async () => {
    await signInAs('committee1@example.com')
    const october = { ...valid, months: ['2026-10'], note: '' }

    expect(await record('en', idOf('4'), noState, form({ ...october, amount: '100' }))).toEqual({
      message: null,
      recorded: { apartmentNumber: '4', amountAgorot: 10_000, months: ['2026-10'] },
    })
    const state = await record('en', idOf('4'), noState, form({ ...october, amount: '250.01' }))

    expect(state.errors?.amount).toEqual([
      errors('tooMuch', { amount: formatAgorot(25_000, 'en') }),
    ])
    expect((await countedOf('4')).filter(({ month }) => month === '2026-10')).toEqual([
      expect.objectContaining({ amountAgorot: 10_000, note: null }),
    ])
  })

  it('refuses more than the months owe together, and writes nothing', async () => {
    await signInAs('committee1@example.com')

    const state = await record('en', idOf('4'), noState, form({ ...valid, amount: '700.01' }))

    expect(state).toEqual({
      values: { ...valid, amount: '700.01' },
      errors: { amount: [errors('tooMuch', { amount: formatAgorot(70_000, 'en') })] },
      message: null,
    })
    expect(await unpaidMonthPayments()).toHaveLength(0)
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuses an amount that leaves a chosen month with nothing', async () => {
    await signInAs('committee1@example.com')

    const state = await record('en', idOf('4'), noState, form({ ...valid, amount: '350' }))

    expect(state.errors?.amount).toEqual([
      errors('tooLittle', { month: formatMonth('2026-11', 'en') }),
    ])
    expect(await unpaidMonthPayments()).toHaveLength(0)
  })

  it('is all or nothing: a paid month among those chosen writes no month at all', async () => {
    await signInAs('committee1@example.com')

    const state = await record(
      'en',
      idOf('4'),
      noState,
      form({ ...valid, months: ['2026-09', '2026-10', '2026-11'], amount: '1050' }),
    )

    expect(state.errors?.months).toEqual([errors('paid', { month: formatMonth('2026-09', 'en') })])
    expect(await unpaidMonthPayments()).toHaveLength(0)
    expect((await countedOf('4')).filter(({ month }) => month === '2026-09')).toHaveLength(1)
  })

  it('takes payment ahead, up to a year, and nothing later', async () => {
    await signInAs('committee1@example.com')
    const ahead = { ...valid, amount: '350' }

    expect(
      (await record('en', idOf('1'), noState, form({ ...ahead, months: ['2027-11'] }))).recorded,
    ).toEqual({ apartmentNumber: '1', amountAgorot: fee, months: ['2027-11'] })
    const state = await record('en', idOf('1'), noState, form({ ...ahead, months: ['2027-12'] }))

    expect(state.errors?.months).toEqual([
      errors('tooFarAhead', { month: formatMonth('2027-11', 'en') }),
    ])
  })

  it('refuses a month before billing starts', async () => {
    await signInAs('committee1@example.com')

    const state = await record(
      'en',
      idOf('4'),
      noState,
      form({ ...valid, months: ['2025-10'], amount: '350' }),
    )

    expect(state.errors?.months).toEqual([
      errors('notBilled', { month: formatMonth('2025-11', 'en') }),
    ])
  })

  it('refreshes the pages when a month was paid meanwhile, and still says why', async () => {
    await signInAs('committee1@example.com')
    const october = { ...valid, months: ['2026-10'], amount: '350' }
    await record('en', idOf('4'), noState, form(october))
    vi.mocked(revalidatePath).mockClear()

    // Someone else recorded October since this form opened: its months are out of date.
    const state = await record('en', idOf('4'), noState, form(october))

    expect(state.errors?.months).toEqual([errors('paid', { month: formatMonth('2026-10', 'en') })])
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/payments', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/apartments/[id]', 'page')
  })

  it('refreshes the pages when the amount is more than is now left', async () => {
    await signInAs('committee1@example.com')
    await record('en', idOf('4'), noState, form({ ...valid, months: ['2026-10'], amount: '100' }))
    vi.mocked(revalidatePath).mockClear()

    const state = await record(
      'en',
      idOf('4'),
      noState,
      form({ ...valid, months: ['2026-10'], amount: '350' }),
    )

    expect(state.errors?.amount).toEqual([
      errors('tooMuch', { amount: formatAgorot(25_000, 'en') }),
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/payments', 'page')
    expect(updateTag).toHaveBeenCalledTimes(1)
  })

  it('does not refresh for a refusal the form itself caused', async () => {
    await signInAs('committee1@example.com')

    await record('en', idOf('4'), noState, form({ ...valid, amount: '350' }))

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('takes a payment dated up to a year before billing starts, and nothing earlier', async () => {
    await signInAs('committee1@example.com')
    const october = { ...valid, months: ['2026-10'], amount: '350' }

    // The building bills from November 2025: November 2024 is the earliest date.
    const state = await record('en', idOf('4'), noState, form({ ...october, paidOn: '2024-10-31' }))

    expect(state.errors?.paidOn).toEqual([
      errors('paidOnTooEarly', { month: formatMonth('2024-11', 'en') }),
    ])
    expect(await unpaidMonthPayments()).toHaveLength(0)
    expect(
      (await record('en', idOf('4'), noState, form({ ...october, paidOn: '2024-11-01' }))).recorded,
    ).toEqual({ apartmentNumber: '4', amountAgorot: fee, months: ['2026-10'] })
  })

  it('takes a payment in advance for an apartment billed from next month', async () => {
    await signInAs('committee1@example.com')
    await db
      .update(apartments)
      .set({ billingStartMonth: '2026-12' })
      .where(eq(apartments.id, idOf('4')))
    try {
      const state = await record(
        'en',
        idOf('4'),
        noState,
        form({ ...valid, months: ['2026-12'], amount: '350', paidOn: '2026-11-02' }),
      )

      expect(state.recorded).toEqual({
        apartmentNumber: '4',
        amountAgorot: fee,
        months: ['2026-12'],
      })
      // Its own billing start counts, not the building's: a year before December 2026.
      const early = await record(
        'en',
        idOf('4'),
        noState,
        form({ ...valid, months: ['2027-01'], amount: '350', paidOn: '2025-11-30' }),
      )
      expect(early.errors?.paidOn).toEqual([
        errors('paidOnTooEarly', { month: formatMonth('2025-12', 'en') }),
      ])
    } finally {
      await db
        .update(apartments)
        .set({ billingStartMonth: null })
        .where(eq(apartments.id, idOf('4')))
    }
  })

  it.each([
    ['no month', { months: [] }, 'months', 'months'],
    ['a malformed month', { months: ['2026-13'] }, 'months', 'months'],
    ['an amount of zero', { amount: '0' }, 'amount', 'amount'],
    ['an amount that is no number', { amount: 'lots' }, 'amount', 'amount'],
    ['no date', { paidOn: '' }, 'paidOn', 'paidOn'],
    ['a date that does not exist', { paidOn: '2026-02-30' }, 'paidOn', 'paidOn'],
    ['a date after today', { paidOn: '2026-11-03' }, 'paidOn', 'paidOnFuture'],
    ['an unknown method', { method: 'gold' }, 'method', 'method'],
    ['a note over 200 characters', { note: 'x'.repeat(201) }, 'note', 'note'],
  ] as const)('rejects %s', async (_case, change, field, message) => {
    await signInAs('committee1@example.com')

    const state = await record('en', idOf('4'), noState, form({ ...valid, ...change }))

    expect(state.errors?.[field]).toEqual([errors(message)])
    expect(state.values).toEqual({ ...valid, ...change })
    expect(await unpaidMonthPayments()).toHaveLength(0)
  })

  it("refuses another building's apartment and a malformed id", async () => {
    await signInAs('committee1@example.com')

    for (const id of [otherApartmentId, 'not-a-uuid']) {
      const state = await record('en', id, noState, form(valid))
      expect(state.message).toBe(errors('notFound'))
    }
    expect(
      await db.select().from(payments).where(eq(payments.apartmentId, otherApartmentId)),
    ).toHaveLength(1)
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await signInAs('committee1@example.com')

    const state = await record('he', idOf('4'), noState, form({ ...valid, months: [] }))

    expect(state.errors?.months).toEqual([he.PaymentErrors.months])
  })

  it('refuses a demo building', async () => {
    await signInAs('committee1@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    const state = await record('en', idOf('4'), noState, form(valid))

    expect(state).toEqual({ values: valid, message: en.Demo.readOnly })
    expect(await unpaidMonthPayments()).toHaveLength(0)
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('voidPayment', () => {
  const noVoidState: VoidPaymentState = {}
  const reason = new FormData()
  reason.set('reason', 'Recorded twice by mistake')

  /** Records October for apartment 4 and returns the payment's id. */
  async function recordedOctober() {
    await signInAs('committee1@example.com')
    await record('en', idOf('4'), noState, form({ ...valid, months: ['2026-10'], amount: '350' }))
    const [row] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.apartmentId, idOf('4')), eq(payments.month, '2026-10')))
    return row.id
  }

  it('refuses a resident', async () => {
    const id = await recordedOctober()
    await signInAs('resident1@example.com')

    const state = await voidPayment('en', id, noVoidState, reason)

    expect(state.message).toBe(en.Authz.forbidden)
    expect((await countedOf('4')).some(({ month }) => month === '2026-10')).toBe(true)
  })

  it('voids it with who, when and why, and the month is overdue again', async () => {
    const id = await recordedOctober()
    const person = await signInAs('admin@example.com')
    expect((await forApartment(idOf('4'), now))?.openMonths[0].month).toBe('2026-11')

    const state = await voidPayment('en', id, noVoidState, reason)

    expect(state).toEqual({
      message: null,
      voided: { apartmentNumber: '4', month: '2026-10', amountAgorot: fee },
    })
    const [row] = await db.select().from(payments).where(eq(payments.id, id))
    expect(row).toMatchObject({
      voidedBy: person.id,
      voidReason: 'Recorded twice by mistake',
      amountAgorot: fee,
    })
    expect(row.voidedAt).toEqual(now)
    expect((await forApartment(idOf('4'), now))?.openMonths[0]).toMatchObject({
      month: '2026-10',
      kind: 'overdue',
    })
    expect(updateTag).toHaveBeenCalledWith(`building:${buildingId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/admin/payments', 'page')
  })

  it('asks for a reason', async () => {
    const id = await recordedOctober()
    const short = new FormData()
    short.set('reason', '  x ')

    const state = await voidPayment('en', id, noVoidState, short)

    expect(state).toEqual({
      values: { reason: '  x ' },
      errors: { reason: [errors('reason')] },
      message: null,
    })
    const [row] = await db.select().from(payments).where(eq(payments.id, id))
    expect(row.voidedAt).toBeNull()
  })

  it('refuses a payment already voided', async () => {
    const id = await recordedOctober()
    await voidPayment('en', id, noVoidState, reason)

    const state = await voidPayment('en', id, noVoidState, reason)

    expect(state.message).toBe(errors('alreadyVoided'))
  })

  it("refuses another building's payment and a malformed id", async () => {
    await signInAs('committee1@example.com')

    for (const id of [otherPaymentId, 'not-a-uuid']) {
      const state = await voidPayment('en', id, noVoidState, reason)
      expect(state.message).toBe(errors('paymentNotFound'))
    }
    const [row] = await db.select().from(payments).where(eq(payments.id, otherPaymentId))
    expect(row.voidedAt).toBeNull()
  })

  it('refuses a demo building', async () => {
    const id = await recordedOctober()
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, buildingId))

    const state = await voidPayment('en', id, noVoidState, reason)

    expect(state).toEqual({
      values: { reason: 'Recorded twice by mistake' },
      message: en.Demo.readOnly,
    })
    const [row] = await db.select().from(payments).where(eq(payments.id, id))
    expect(row.voidedAt).toBeNull()
  })
})
