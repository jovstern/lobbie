import { readdir, rm } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  record,
  voidExpense,
  type ExpenseFormState,
  type VoidExpenseState,
} from '@/app/lib/actions/expenses'
import { balance } from '@/app/lib/data/ledger'
import { db } from '@/app/lib/db'
import { buildings, expenses, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { get, put } from '@/app/lib/storage'
import { formatDay } from '@/app/lib/utils/dates'
import { maxReceiptBytes } from '@/app/lib/utils/receipt-file'
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

// The real storage, on a folder of its own; `put` is watched, so a test can make it fail.
const uploads = await vi.hoisted(async () => {
  const { mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  return mkdtemp(path.join(tmpdir(), 'lobbie-expenses-'))
})
vi.mock('@/app/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/storage')>()
  const storage = actual.createStorage(actual.localDriver(uploads))
  return { ...actual, put: vi.fn(storage.put), get: storage.get, remove: storage.remove }
})
afterAll(async () => {
  await testDb.close()
  await rm(uploads, { recursive: true, force: true })
})

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
  getTranslations: async ({ locale, namespace }: { locale: Locale; namespace: 'ExpenseErrors' }) =>
    createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// The seed bills from November 2025, so an expense may be dated from November 1, 2025 on:
// spending before then is part of the opening balance.
const now = new Date('2026-11-02T10:00:00Z')
const errors = createTranslator({ locale: 'en', messages: en, namespace: 'ExpenseErrors' })

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

let otherExpenseId: string

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

type Fields = { category: string; amount: string; spentOn: string; description: string }

const valid: Fields = {
  category: 'repairs',
  amount: '1,250.50',
  spentOn: '2026-11-01',
  description: 'Lobby door closer',
}

/** No file chosen: browsers send an empty, nameless file. */
const noFile = () => new File([], '', { type: 'application/octet-stream' })

function form(fields: Fields, receipt: File = noFile()) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  data.set('receipt', receipt)
  return data
}

const noState: ExpenseFormState = {}
const storedFiles = async () => readdir(uploads).catch(() => [])
const demoExpenses = () => db.select().from(expenses).where(eq(expenses.buildingId, demoBuildingId))

let seededCount: number

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now })
  seededCount = (await demoExpenses()).length

  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  const [someone] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  const [expense] = await db
    .insert(expenses)
    .values({
      buildingId: other.id,
      category: 'water',
      amountAgorot: 1_000,
      spentOn: '2026-10-01',
      description: 'Not this building',
      recordedBy: someone.id,
    })
    .returning()
  otherExpenseId = expense.id
}, 30_000)

beforeEach(() => {
  // Only Date: the database client keeps its real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.mocked(updateTag).mockClear()
  vi.mocked(revalidatePath).mockClear()
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  // Back to the seed: its expenses only, none voided, and no files.
  const seeded = await demoExpenses()
  for (const row of seeded.slice(seededCount)) {
    await db.delete(expenses).where(eq(expenses.id, row.id))
  }
  await db.delete(expenses).where(eq(expenses.description, valid.description))
  await rm(uploads, { recursive: true, force: true })
  await db.update(buildings).set({ isDemo: false }).where(eq(buildings.id, demoBuildingId))
})

describe('record', () => {
  it('refuses a resident and keeps what was typed', async () => {
    await signInAs('resident1@example.com')

    const state = await record('en', noState, form(valid))

    expect(state).toEqual({ values: { ...valid, receiptName: '' }, message: en.Authz.forbidden })
    expect(await demoExpenses()).toHaveLength(seededCount)
  })

  it.each(['committee1@example.com', 'admin@example.com'])(
    'records an expense with its receipt for %s, and the fund drops by it',
    async (email) => {
      const person = await signInAs(email)
      const before = await balance(demoBuildingId)
      const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })

      const state = await record('en', noState, form(valid, receipt))

      expect(state).toEqual({
        message: null,
        recorded: { description: valid.description, amountAgorot: 125_050 },
      })
      const [row] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.description, valid.description))
      expect(row).toMatchObject({
        buildingId: demoBuildingId,
        category: 'repairs',
        amountAgorot: 125_050,
        spentOn: '2026-11-01',
        recordedBy: person.id,
        voidedAt: null,
      })
      expect(row.receiptKey).toMatch(/^[0-9a-f-]{36}\.pdf$/)
      expect(await get(row.receiptKey ?? '')).toEqual({
        bytes: pdfBytes,
        contentType: 'application/pdf',
      })
      expect((await balance(demoBuildingId)).totalAgorot).toBe(before.totalAgorot - 125_050)
      // The fund is cached under the building's tag; Home shows it.
      expect(updateTag).toHaveBeenCalledWith(`building:${demoBuildingId}`)
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/admin/expenses', 'page')
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/(home)', 'page')
      expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/money/balance', 'page')
    },
  )

  it('records an expense without a receipt', async () => {
    await signInAs('committee1@example.com')

    const state = await record('en', noState, form(valid))

    expect(state.recorded).toEqual({ description: valid.description, amountAgorot: 125_050 })
    const [row] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.description, valid.description))
    expect(row.receiptKey).toBeNull()
    expect(await storedFiles()).toEqual([])
  })

  // Browsers send an empty file part when none was chosen, not always nameless: some name it
  // "blob" or "undefined". No bytes is no receipt, whatever its name.
  it.each(['', 'blob', 'undefined', 'r.pdf'])(
    'takes an empty file named %o as no receipt',
    async (name) => {
      await signInAs('committee1@example.com')
      const empty = new File([], name, { type: 'application/octet-stream' })

      const state = await record('en', noState, form(valid, empty))

      expect(state.recorded).toEqual({ description: valid.description, amountAgorot: 125_050 })
      const [row] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.description, valid.description))
      expect(row.receiptKey).toBeNull()
      expect(await storedFiles()).toEqual([])
    },
  )

  it('gives back no receipt name for an empty file when a field is refused', async () => {
    await signInAs('committee1@example.com')
    const empty = new File([], 'blob', { type: 'application/octet-stream' })

    const state = await record('en', noState, form({ ...valid, amount: '0' }, empty))

    expect(state.values?.receiptName).toBe('')
    expect(state.errors?.receipt).toBeUndefined()
  })

  it('keeps an image by its bytes, whatever its name and declared type', async () => {
    await signInAs('committee1@example.com')
    const receipt = new File([jpegBytes], 'scan.pdf', { type: 'application/pdf' })

    await record('en', noState, form(valid, receipt))

    const [row] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.description, valid.description))
    expect(row.receiptKey).toMatch(/\.jpg$/)
    expect((await get(row.receiptKey ?? ''))?.contentType).toBe('image/jpeg')
  })

  it.each([
    [
      'an HTML page named .pdf',
      new File(['<html><script>alert(1)</script>'], 'r.pdf', { type: 'application/pdf' }),
      'receiptType',
    ],
    [
      'a program named .png',
      new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], 'r.png', { type: 'image/png' }),
      'receiptType',
    ],
    [
      'an SVG',
      new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'r.svg', { type: 'image/svg+xml' }),
      'receiptType',
    ],
    [
      'a file over 4 MB',
      new File([pdfBytes, new Uint8Array(maxReceiptBytes)], 'r.pdf', { type: 'application/pdf' }),
      'receiptTooLarge',
    ],
  ] as const)('refuses %s, and keeps nothing', async (_, receipt, message) => {
    await signInAs('committee1@example.com')

    const state = await record('en', noState, form(valid, receipt))

    expect(state).toEqual({
      values: { ...valid, receiptName: receipt.name },
      errors: { receipt: [errors(message)] },
      message: null,
    })
    expect(await demoExpenses()).toHaveLength(seededCount)
    expect(await storedFiles()).toEqual([])
    expect(updateTag).not.toHaveBeenCalled()
  })

  it.each([
    ['category', { category: 'parties' }, 'category'],
    ['category', { category: '' }, 'category'],
    ['amount', { amount: '0' }, 'amount'],
    ['amount', { amount: '-5' }, 'amount'],
    ['amount', { amount: 'abc' }, 'amount'],
    ['spentOn', { spentOn: '2026-02-30' }, 'spentOn'],
    ['spentOn', { spentOn: '2026-11-03' }, 'spentOnFuture'],
    ['description', { description: ' x ' }, 'description'],
    ['description', { description: 'x'.repeat(201) }, 'description'],
  ] as const)('refuses a bad %s (%o)', async (field, change, message) => {
    await signInAs('committee1@example.com')

    const state = await record('en', noState, form({ ...valid, ...change }))

    expect(state.errors?.[field]).toEqual([errors(message)])
    expect(state.values).toEqual({ ...valid, ...change, receiptName: '' })
    expect(await demoExpenses()).toHaveLength(seededCount)
  })

  it('refuses a date before billing starts, saying from when', async () => {
    await signInAs('committee1@example.com')
    const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })

    const state = await record('en', noState, form({ ...valid, spentOn: '2025-10-31' }, receipt))

    expect(state.errors?.spentOn).toEqual([
      errors('spentOnTooEarly', { date: formatDay('2025-11-01', 'en') }),
    ])
    expect(await demoExpenses()).toHaveLength(seededCount)
    expect(await storedFiles()).toEqual([])
  })

  it('takes the first day of the billing start month', async () => {
    await signInAs('committee1@example.com')

    const state = await record('en', noState, form({ ...valid, spentOn: '2025-11-01' }))

    expect(state.recorded).toEqual({ description: valid.description, amountAgorot: 125_050 })
  })

  it('removes the receipt again when the expense cannot be saved', async () => {
    await signInAs('committee1@example.com')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('connection lost')
    })
    const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })

    const state = await record('en', noState, form(valid, receipt))

    expect(state).toEqual({
      values: { ...valid, receiptName: 'receipt.pdf' },
      message: errors('saveFailed'),
    })
    expect(put).toHaveBeenCalledOnce()
    expect(await storedFiles()).toEqual([])
    expect(await demoExpenses()).toHaveLength(seededCount)
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('saves no expense when its receipt cannot be stored', async () => {
    await signInAs('committee1@example.com')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(put).mockRejectedValueOnce(new Error('disk full'))
    const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })

    const state = await record('en', noState, form(valid, receipt))

    expect(state.message).toBe(errors('saveFailed'))
    expect(await demoExpenses()).toHaveLength(seededCount)
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      area: 'actions/expenses',
      route: '/admin/expenses',
    })
  })

  it('answers in Hebrew on the Hebrew page', async () => {
    await signInAs('committee1@example.com')

    const state = await record('he', noState, form({ ...valid, category: '' }))

    expect(state.errors?.category).toEqual([he.ExpenseErrors.category])
  })

  it('refuses a demo building, and keeps no file', async () => {
    await signInAs('committee1@example.com')
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))
    const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })

    const state = await record('en', noState, form(valid, receipt))

    expect(state).toEqual({
      values: { ...valid, receiptName: 'receipt.pdf' },
      message: en.Demo.readOnly,
    })
    expect(await demoExpenses()).toHaveLength(seededCount)
    expect(await storedFiles()).toEqual([])
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('voidExpense', () => {
  const noVoidState: VoidExpenseState = {}
  const reason = new FormData()
  reason.set('reason', 'Recorded twice by mistake')

  /** Records the valid expense, with a receipt, and returns its row. */
  async function recorded() {
    await signInAs('committee1@example.com')
    const receipt = new File([pdfBytes], 'receipt.pdf', { type: 'application/pdf' })
    await record('en', noState, form(valid, receipt))
    const [row] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.description, valid.description))
    vi.mocked(updateTag).mockClear()
    return row
  }

  it('refuses a resident', async () => {
    const { id } = await recorded()
    await signInAs('resident1@example.com')

    const state = await voidExpense('en', id, noVoidState, reason)

    expect(state.message).toBe(en.Authz.forbidden)
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id))
    expect(row.voidedAt).toBeNull()
  })

  it('voids it with who, when and why; the fund gets it back and the receipt stays', async () => {
    const { id, receiptKey } = await recorded()
    const person = await signInAs('admin@example.com')
    const before = await balance(demoBuildingId)

    const state = await voidExpense('en', id, noVoidState, reason)

    expect(state).toEqual({
      message: null,
      voided: { description: valid.description, amountAgorot: 125_050 },
    })
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id))
    expect(row).toMatchObject({ voidedBy: person.id, voidReason: 'Recorded twice by mistake' })
    expect(row.voidedAt).toEqual(now)
    expect((await balance(demoBuildingId)).totalAgorot).toBe(before.totalAgorot + 125_050)
    expect(await get(receiptKey ?? '')).not.toBeNull()
    expect(updateTag).toHaveBeenCalledWith(`building:${demoBuildingId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/admin/expenses', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/(home)', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/(app)/money/balance', 'page')
  })

  it('asks for a reason', async () => {
    const { id } = await recorded()
    const short = new FormData()
    short.set('reason', '  x ')

    const state = await voidExpense('en', id, noVoidState, short)

    expect(state).toEqual({
      values: { reason: '  x ' },
      errors: { reason: [errors('reason')] },
      message: null,
    })
  })

  it('refuses an expense already voided', async () => {
    const { id } = await recorded()
    await voidExpense('en', id, noVoidState, reason)

    const state = await voidExpense('en', id, noVoidState, reason)

    expect(state.message).toBe(errors('alreadyVoided'))
  })

  it("refuses another building's expense and a malformed id", async () => {
    await signInAs('committee1@example.com')

    for (const id of [otherExpenseId, 'not-a-uuid']) {
      const state = await voidExpense('en', id, noVoidState, reason)
      expect(state.message).toBe(errors('notFound'))
    }
    const [row] = await db.select().from(expenses).where(eq(expenses.id, otherExpenseId))
    expect(row.voidedAt).toBeNull()
  })

  it('refuses a demo building', async () => {
    const { id } = await recorded()
    await db.update(buildings).set({ isDemo: true }).where(eq(buildings.id, demoBuildingId))

    const state = await voidExpense('en', id, noVoidState, reason)

    expect(state).toEqual({
      values: { reason: 'Recorded twice by mistake' },
      message: en.Demo.readOnly,
    })
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id))
    expect(row.voidedAt).toBeNull()
  })
})
