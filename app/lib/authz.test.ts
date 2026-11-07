import { eq } from 'drizzle-orm'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizeAction, requireMember, requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import { apartmentResidents, apartments, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import en from '@/messages/en.json'
import { seed } from '@/scripts/seed'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
afterAll(() => testDb.close())

class Redirected extends Error {
  constructor(readonly target: unknown) {
    super('NEXT_REDIRECT')
  }
}
class NotFound extends Error {}

const requestHeaders = vi.hoisted(() => new Headers())
vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn((target: unknown) => {
    throw new Redirected(target)
  }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new NotFound()
  }),
}))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getTranslations: async ({ namespace }: { namespace: 'Authz' }) =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

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
  return found.id
}

let outsiderEmail: string

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  // As a demo building, so the member's `isDemo` is shown to come from the building.
  await seed(db, { now: new Date('2026-11-02T10:00:00Z'), demo: true })
  outsiderEmail = 'new@example.com'
  await db.insert(user).values({ name: '', email: outsiderEmail, emailVerified: true })
}, 30_000)

beforeEach(() => {
  vi.mocked(getSession).mockReset()
  requestHeaders.delete('x-request-path')
})

describe('requireMember', () => {
  it('sends a signed-out visitor to sign in, then back to the page they asked for', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    requestHeaders.set('x-request-path', '/en/money?month=2026-10')

    await expect(requireMember()).rejects.toEqual(
      new Redirected({ href: '/sign-in?next=%2Fen%2Fmoney%3Fmonth%3D2026-10', locale: 'en' }),
    )
  })

  it('falls back to the home page when the path is missing or unsafe', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    requestHeaders.set('x-request-path', '//evil.com')

    await expect(requireMember()).rejects.toEqual(
      new Redirected({ href: '/sign-in?next=%2Fen', locale: 'en' }),
    )
  })

  it('sends a signed-in person without a building to /join', async () => {
    await signInAs(outsiderEmail)

    await expect(requireMember()).rejects.toEqual(new Redirected({ href: '/join', locale: 'en' }))
  })

  it('returns the member with their building and every apartment they live in', async () => {
    const userId = await signInAs('resident1@example.com')
    const [apartment] = await db
      .select({ id: apartments.id, buildingId: apartments.buildingId })
      .from(apartments)
      .where(eq(apartments.number, '1'))

    expect(await requireMember()).toEqual({
      userId,
      buildingId: apartment.buildingId,
      role: 'resident',
      apartmentIds: [apartment.id],
      isDemo: true,
      timeZone: 'Asia/Jerusalem',
      buildingName: 'רחוב הרימון 12',
    })
  })

  it('lists a member with no apartment with an empty list', async () => {
    const userId = await signInAs('committee1@example.com')
    const [row] = await db
      .delete(apartmentResidents)
      .where(eq(apartmentResidents.userId, userId))
      .returning()

    expect((await requireMember()).apartmentIds).toEqual([])
    await db.insert(apartmentResidents).values(row)
  })
})

describe('requireRole', () => {
  it('hides a committee page from a resident with a 404', async () => {
    await signInAs('resident1@example.com')

    await expect(requireRole('committee')).rejects.toBeInstanceOf(NotFound)
  })

  it.each([
    ['committee1@example.com', 'committee'],
    ['admin@example.com', 'committee'],
    ['admin@example.com', 'admin'],
  ] as const)('lets %s through at %s', async (email, min) => {
    await signInAs(email)

    expect((await requireRole(min)).userId).toBeTruthy()
  })
})

describe('authorizeAction', () => {
  it('refuses a signed-out caller with a message', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    expect(await authorizeAction('resident', 'en')).toEqual({
      ok: false,
      message: en.Authz.signedOut,
    })
  })

  it('refuses a caller without a building', async () => {
    await signInAs(outsiderEmail)

    expect(await authorizeAction('resident', 'en')).toEqual({
      ok: false,
      message: en.Authz.noMembership,
    })
  })

  it('refuses a role below the minimum', async () => {
    await signInAs('resident1@example.com')

    expect(await authorizeAction('committee', 'en')).toEqual({
      ok: false,
      message: en.Authz.forbidden,
    })
  })

  it('returns the member when the role is enough', async () => {
    const userId = await signInAs('committee2@example.com')

    expect(await authorizeAction('committee', 'en')).toMatchObject({
      ok: true,
      member: { userId, role: 'committee' },
    })
  })
})
