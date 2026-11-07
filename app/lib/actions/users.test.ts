import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createTranslator } from 'next-intl'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setLocale,
  setShowContact,
  updateCommitteeContact,
  updateProfile,
} from '@/app/lib/actions/users'
import { db } from '@/app/lib/db'
import type { Role } from '@/app/lib/definitions'
import { buildingMembers, buildings, user } from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

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

const cookieStore = vi.hoisted(() => ({ set: vi.fn() }))
vi.mock('@/app/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => cookieStore,
}))
vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn((target: unknown) => {
    throw new Redirected(target)
  }),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: Locale
    namespace: 'Authz' | 'Demo' | 'ProfileErrors'
  }) => createTranslator({ locale, messages: locale === 'he' ? he : en, namespace }),
}))

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

// A fixed clock: nothing here depends on the time, but the sessions need one.
const now = new Date('2026-11-02T10:00:00Z')

async function signInAs(userId: string) {
  const [person] = await db.select().from(user).where(eq(user.id, userId))
  const session: Session = {
    user: person,
    session: {
      id: 'session-id',
      userId: person.id,
      token: 'token',
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    },
  }
  vi.mocked(getSession).mockResolvedValue(session)
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

/** Everything the actions could write, for one person: their user row and membership. */
async function rowsOf(userId: string) {
  const [person] = await db
    .select({ name: user.name, phone: user.phone, locale: user.locale })
    .from(user)
    .where(eq(user.id, userId))
  const [membership] = await db
    .select({
      showContact: buildingMembers.showContact,
      committeeTitle: buildingMembers.committeeTitle,
      committeePhone: buildingMembers.committeePhone,
      committeeEmail: buildingMembers.committeeEmail,
    })
    .from(buildingMembers)
    .where(eq(buildingMembers.userId, userId))
  return { ...person, ...membership }
}

let made = 0
async function newMember(buildingId: string, role: Role = 'resident') {
  made += 1
  const [person] = await db
    .insert(user)
    .values({
      name: `Person ${made}`,
      email: `person-${made}@test.example`,
      phone: '+972505550100',
    })
    .returning()
  await db.insert(buildingMembers).values({
    userId: person.id,
    buildingId,
    role,
    committeeTitle: role === 'resident' ? null : 'Treasurer',
  })
  return person.id
}

let buildingId: string
let demoBuildingId: string
/** A neighbour in the same building and someone in another one: no action may touch them. */
let bystanders: string[]

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  const [building, other, demo] = await db
    .insert(buildings)
    .values([
      { name: 'Test', address: 'Here 1', billingStartMonth: '2026-01' },
      { name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' },
      { name: 'Demo', address: 'Demo 1', billingStartMonth: '2026-01', isDemo: true },
    ])
    .returning()
  buildingId = building.id
  demoBuildingId = demo.id
  bystanders = [await newMember(buildingId, 'committee'), await newMember(other.id, 'committee')]
}, 30_000)

let bystandersBefore: Awaited<ReturnType<typeof rowsOf>>[]

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear()
  vi.mocked(redirect).mockClear()
  cookieStore.set.mockClear()
  bystandersBefore = await Promise.all(bystanders.map(rowsOf))
})

async function expectBystandersUntouched() {
  expect(await Promise.all(bystanders.map(rowsOf))).toEqual(bystandersBefore)
}

describe('updateProfile', () => {
  it('saves the caller’s own name and phone in E.164, and refreshes the profile', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    const state = await updateProfile(
      'en',
      {},
      form({ name: '  Dana Zur ', phone: '054 555-0301' }),
    )

    expect(state).toMatchObject({
      values: { name: 'Dana Zur', phone: '054-555-0301' },
      message: null,
      savedAt: expect.any(Number),
    })
    expect(await rowsOf(me)).toMatchObject({ name: 'Dana Zur', phone: '+972545550301' })
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/profile', 'page')
    await expectBystandersUntouched()
  })

  it('clears the phone when the field is left empty', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    const state = await updateProfile('en', {}, form({ name: 'Dana Zur', phone: '  ' }))

    expect(state.values).toEqual({ name: 'Dana Zur', phone: '' })
    expect(await rowsOf(me)).toMatchObject({ phone: null })
  })

  it.each([
    ['a name too short', { name: ' A ', phone: '' }, { name: [en.ProfileErrors.name] }],
    ['a name too long', { name: 'A'.repeat(61), phone: '' }, { name: [en.ProfileErrors.name] }],
    [
      'a foreign phone',
      { name: 'Dana', phone: '+1 202 555 0101' },
      { phone: [en.ProfileErrors.phone] },
    ],
    ['a short phone', { name: 'Dana', phone: '050-555' }, { phone: [en.ProfileErrors.phone] }],
  ])('refuses %s, keeping what was typed', async (_case, fields, errors) => {
    const me = await newMember(buildingId)
    await signInAs(me)
    const before = await rowsOf(me)

    expect(await updateProfile('en', {}, form(fields))).toEqual({
      values: fields,
      errors,
      message: null,
    })
    expect(await rowsOf(me)).toEqual(before)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('answers in the page’s language', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    const state = await updateProfile('he', {}, form({ name: 'A', phone: '' }))

    expect(state.errors?.name).toEqual([he.ProfileErrors.name])
  })
})

describe('setShowContact', () => {
  it('turns the caller’s own directory contact on and off', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    expect(await setShowContact('en', {}, form({ showContact: 'true' }))).toEqual({
      message: null,
    })
    expect(await rowsOf(me)).toMatchObject({ showContact: true })
    expect(await setShowContact('en', {}, form({ showContact: 'false' }))).toEqual({
      message: null,
    })
    expect(await rowsOf(me)).toMatchObject({ showContact: false })
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/profile', 'page')
    await expectBystandersUntouched()
  })

  it('refuses a value that is not on or off', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    expect(await setShowContact('en', {}, form({ showContact: 'yes' }))).toEqual({
      message: en.ProfileErrors.saveFailed,
    })
    expect(await rowsOf(me)).toMatchObject({ showContact: false })
  })
})

describe('setLocale', () => {
  it('saves the language to the caller and the cookie, then opens the profile in it', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    await expect(setLocale('he', {}, form({ locale: 'en' }))).rejects.toThrow(Redirected)

    expect(await rowsOf(me)).toMatchObject({ locale: 'en' })
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'NEXT_LOCALE', value: 'en', path: '/' }),
    )
    expect(redirect).toHaveBeenCalledWith({ href: '/profile#language', locale: 'en' })
    await expectBystandersUntouched()
  })

  it('refuses a language the app does not have, changing nothing', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)

    expect(await setLocale('en', {}, form({ locale: 'fr' }))).toEqual({
      message: en.ProfileErrors.locale,
    })
    expect(await rowsOf(me)).toMatchObject({ locale: 'he' })
    expect(cookieStore.set).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('updateCommitteeContact', () => {
  it('saves the caller’s own committee contact, leaving the title to the admin', async () => {
    const me = await newMember(buildingId, 'committee')
    await signInAs(me)

    const state = await updateCommitteeContact(
      'en',
      {},
      // A title sent anyway is ignored.
      form({
        committeePhone: '+972 3 555 0101',
        committeeEmail: ' vaad@test.example ',
        committeeTitle: 'Chair',
      }),
    )

    expect(state).toMatchObject({
      values: { committeePhone: '03-555-0101', committeeEmail: 'vaad@test.example' },
      message: null,
    })
    expect(await rowsOf(me)).toMatchObject({
      committeeTitle: 'Treasurer',
      committeePhone: '+97235550101',
      committeeEmail: 'vaad@test.example',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/profile', 'page')
    await expectBystandersUntouched()
  })

  it('unpublishes the contact when both fields are empty', async () => {
    const me = await newMember(buildingId, 'admin')
    await signInAs(me)
    await updateCommitteeContact(
      'en',
      {},
      form({ committeePhone: '050-555-0101', committeeEmail: 'a@test.example' }),
    )

    await updateCommitteeContact('en', {}, form({ committeePhone: '', committeeEmail: '' }))

    expect(await rowsOf(me)).toMatchObject({ committeePhone: null, committeeEmail: null })
  })

  it('refuses a bad phone and a bad email, keeping what was typed', async () => {
    const me = await newMember(buildingId, 'committee')
    await signInAs(me)
    const fields = { committeePhone: '12345', committeeEmail: 'not-an-email' }

    expect(await updateCommitteeContact('en', {}, form(fields))).toEqual({
      values: fields,
      errors: {
        committeePhone: [en.ProfileErrors.committeePhone],
        committeeEmail: [en.ProfileErrors.committeeEmail],
      },
      message: null,
    })
    expect(await rowsOf(me)).toMatchObject({ committeePhone: null, committeeEmail: null })
  })

  it('refuses a resident', async () => {
    const me = await newMember(buildingId)
    await signInAs(me)
    const fields = { committeePhone: '050-555-0101', committeeEmail: 'a@test.example' }

    expect(await updateCommitteeContact('en', {}, form(fields))).toEqual({
      values: fields,
      message: en.Authz.forbidden,
    })
    expect(await rowsOf(me)).toMatchObject({ committeePhone: null, committeeEmail: null })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('in a demo building', () => {
  it('refuses every write', async () => {
    const me = await newMember(demoBuildingId, 'committee')
    await signInAs(me)
    const before = await rowsOf(me)

    expect(
      (await updateProfile('en', {}, form({ name: 'Dana Zur', phone: '050-555-0101' }))).message,
    ).toBe(en.Demo.readOnly)
    expect((await setShowContact('en', {}, form({ showContact: 'true' }))).message).toBe(
      en.Demo.readOnly,
    )
    expect(
      (
        await updateCommitteeContact(
          'en',
          {},
          form({ committeePhone: '050-555-0101', committeeEmail: '' }),
        )
      ).message,
    ).toBe(en.Demo.readOnly)

    expect(await rowsOf(me)).toEqual(before)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('still changes the language, in the cookie only', async () => {
    const me = await newMember(demoBuildingId)
    await signInAs(me)

    await expect(setLocale('he', {}, form({ locale: 'en' }))).rejects.toThrow(Redirected)

    expect(await rowsOf(me)).toMatchObject({ locale: 'he' })
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'NEXT_LOCALE', value: 'en' }),
    )
    expect(redirect).toHaveBeenCalledWith({ href: '/profile#language', locale: 'en' })
  })
})

describe('signed out', () => {
  it('writes nothing', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    expect((await updateProfile('en', {}, form({ name: 'Dana', phone: '' }))).message).toBe(
      en.Authz.signedOut,
    )
    expect((await setLocale('en', {}, form({ locale: 'en' }))).message).toBe(en.Authz.signedOut)
    expect(cookieStore.set).not.toHaveBeenCalled()
  })
})
