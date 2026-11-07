// @vitest-environment node
import { rm } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/app/lib/db'
import { buildingMembers, buildings, expenses, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { checkFile, put } from '@/app/lib/storage'
import { demoBuildingId } from '@/scripts/demo-building'
import { seed } from '@/scripts/seed'
import { GET } from './route'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))

// The real storage, on a folder of its own.
const uploads = await vi.hoisted(async () => {
  const { mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  return mkdtemp(path.join(tmpdir(), 'lobbie-files-'))
})
vi.mock('@/app/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/storage')>()
  return { ...actual, ...actual.createStorage(actual.localDriver(uploads)) }
})
afterAll(async () => {
  await testDb.close()
  await rm(uploads, { recursive: true, force: true })
})

vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({ redirect: vi.fn() }))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])

let pdfKey: string
let pngKey: string
let strayKey: string

async function store(bytes: Uint8Array) {
  const check = checkFile(bytes)
  if (!check.ok) throw new Error(check.reason)
  return put(check.file)
}

async function signInAs(email: string | null) {
  if (email === null) {
    vi.mocked(getSession).mockResolvedValue(null)
    return
  }
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
}

const open = (key: string) =>
  GET(new Request(`http://localhost/api/files/${key}`), { params: Promise.resolve({ id: key }) })

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  await seed(db, { now: new Date('2026-11-02T10:00:00Z') })
  const [treasurer] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
  pdfKey = await store(pdfBytes)
  pngKey = await store(pngBytes)
  // A file in the store that no expense names.
  strayKey = await store(pdfBytes)
  const expense = {
    buildingId: demoBuildingId,
    category: 'repairs' as const,
    amountAgorot: 50_000,
    spentOn: '2026-11-01',
    recordedBy: treasurer.id,
  }
  await db.insert(expenses).values([
    { ...expense, description: 'Door', receiptKey: pdfKey },
    {
      ...expense,
      description: 'Bulbs',
      receiptKey: pngKey,
      voidedAt: new Date(),
      voidedBy: treasurer.id,
      voidReason: 'Recorded twice',
    },
  ])

  // Someone of another building, and someone signed in without one.
  const [other] = await db
    .insert(buildings)
    .values({ name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' })
    .returning()
  const [elsewhere] = await db
    .insert(user)
    .values([
      { name: 'Elsewhere', email: 'elsewhere@example.com', emailVerified: true },
      { name: 'Homeless', email: 'homeless@example.com', emailVerified: true },
    ])
    .returning()
  await db
    .insert(buildingMembers)
    .values({ userId: elsewhere.id, buildingId: other.id, role: 'admin' })
}, 30_000)

describe('GET /api/files/[id]', () => {
  it('gives a member of the building a PDF receipt as a download, never cached in common', async () => {
    await signInAs('resident1@example.com')

    const response = await open(pdfKey)

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdfBytes)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="receipt-2026-11-01.pdf"',
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
  })

  it("shows an image inline, a voided expense's too", async () => {
    await signInAs('committee1@example.com')

    const response = await open(pngKey)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Content-Disposition')).toBe(
      'inline; filename="receipt-2026-11-01.png"',
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it.each([
    ["another building's admin", 'elsewhere@example.com'],
    ['someone without a building', 'homeless@example.com'],
    ['someone signed out', null],
  ])('answers %s with a 404 and no file', async (_, email) => {
    await signInAs(email)

    const response = await open(pdfKey)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not found')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('answers a stored file that no expense names, and a key that is not one, with a 404', async () => {
    await signInAs('admin@example.com')

    for (const key of [strayKey, '..%2F..%2F.env.local', '../../package.json', 'receipt.pdf']) {
      expect((await open(key)).status, key).toBe(404)
    }
  })

  it('answers a receipt whose file is gone with a 404, and logs it', async () => {
    await signInAs('admin@example.com')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const goneKey = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg'
    const [treasurer] = await db.select().from(user).where(eq(user.email, 'committee2@example.com'))
    await db.insert(expenses).values({
      buildingId: demoBuildingId,
      category: 'other',
      amountAgorot: 100,
      spentOn: '2026-11-01',
      description: 'Lost',
      receiptKey: goneKey,
      recordedBy: treasurer.id,
    })

    expect((await open(goneKey)).status).toBe(404)
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      route: '/api/files/[id]',
    })
    consoleError.mockRestore()
  })
})
