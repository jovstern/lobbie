import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireMember } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member, Role } from '@/app/lib/definitions'
import { apartmentResidents, apartments, buildingMembers, buildings, user } from '@/app/lib/schema'
import { committee, list } from './directory'

const testDb = await vi.hoisted(async () => {
  const { createTestDb } = await import('@/app/lib/test/db')
  return createTestDb()
})
vi.mock('@/app/lib/db', () => ({ db: testDb.db }))
vi.mock('@/app/lib/authz', () => ({ requireMember: vi.fn() }))
afterAll(() => testDb.close())

function signInAs(buildingId: string) {
  const member: Member = {
    userId: 'not-read',
    buildingId,
    role: 'resident',
    apartmentIds: [],
    isDemo: false,
    timeZone: 'Asia/Jerusalem',
    buildingName: 'not-read',
  }
  vi.mocked(requireMember).mockResolvedValue(member)
}

// What must never leave the database: personal contacts of people who did not opt in.
const hidden = ['050-2222222', 'ben@hidden.example', '050-3333333', 'chen@hidden.example']

let buildingId: string
let otherBuildingId: string

type PersonFixture = {
  name: string
  email: string
  phone: string | null
  apartment?: string
  isOwner?: boolean
  role?: Role
  showContact?: boolean
  committeeTitle?: string
  committeePhone?: string
  committeeEmail?: string
}

async function addPeople(
  inBuilding: string,
  apartmentIds: Map<string, string>,
  people: PersonFixture[],
) {
  for (const person of people) {
    const [row] = await db
      .insert(user)
      .values({ name: person.name, email: person.email, phone: person.phone })
      .returning()
    await db.insert(buildingMembers).values({
      userId: row.id,
      buildingId: inBuilding,
      role: person.role ?? 'resident',
      showContact: person.showContact ?? false,
      committeeTitle: person.committeeTitle ?? null,
      committeePhone: person.committeePhone ?? null,
      committeeEmail: person.committeeEmail ?? null,
    })
    if (person.apartment) {
      await db.insert(apartmentResidents).values({
        userId: row.id,
        apartmentId: apartmentIds.get(person.apartment) ?? '',
        isOwner: person.isOwner ?? false,
      })
    }
  }
}

// PGlite's migrations and seed can outlast the default 10 s on a busy machine.
beforeAll(async () => {
  const [building, other] = await db
    .insert(buildings)
    .values([
      { name: 'Test', address: 'Here 1', billingStartMonth: '2026-01' },
      { name: 'Other', address: 'Elsewhere 1', billingStartMonth: '2026-01' },
    ])
    .returning()
  buildingId = building.id
  otherBuildingId = other.id
  // Inserted out of order, so the result cannot rely on insertion order.
  const saved = await db
    .insert(apartments)
    .values([
      { buildingId, number: '10', floor: 1 },
      { buildingId, number: '2A', floor: 1 },
      { buildingId, number: '2', floor: 1 },
      { buildingId, number: '1', floor: 0 },
      { buildingId, number: '20', floor: 2 },
      { buildingId: otherBuildingId, number: '2', floor: 1 },
    ])
    .returning()
  const ids = new Map(saved.filter((a) => a.buildingId === buildingId).map((a) => [a.number, a.id]))
  const otherIds = new Map(
    saved.filter((a) => a.buildingId === otherBuildingId).map((a) => [a.number, a.id]),
  )

  await addPeople(buildingId, ids, [
    {
      name: 'Ben Cohen',
      email: 'ben@hidden.example',
      phone: '050-2222222',
      apartment: '2',
    },
    {
      name: 'ana Levi',
      email: 'ana@shown.example',
      phone: '050-1111111',
      apartment: '2',
      isOwner: true,
      showContact: true,
    },
    {
      name: 'Chen Mor',
      email: 'chen@hidden.example',
      phone: '050-3333333',
      apartment: '10',
      role: 'committee',
      committeeTitle: ' יו"ר ',
      committeePhone: '03-5550000',
      committeeEmail: 'chair@committee.example',
    },
    {
      name: 'Dana Zur',
      email: 'dana@shown.example',
      phone: null,
      apartment: '1',
      role: 'admin',
      showContact: true,
    },
    {
      name: 'Eli Bar',
      email: 'eli@shown.example',
      phone: '  ',
      apartment: '2A',
      role: 'committee',
      showContact: true,
      committeeTitle: 'Treasurer',
      committeePhone: '  ',
      committeeEmail: 'treasurer@committee.example',
    },
    // A member with no apartment: on the committee page, never in the directory.
    { name: 'Avi Adam', email: 'avi@hidden.example', phone: '050-4444444', role: 'admin' },
  ])
  await addPeople(otherBuildingId, otherIds, [
    {
      name: 'Another Building Person',
      email: 'stranger@test.example',
      phone: '050-9999999',
      apartment: '2',
      role: 'admin',
      showContact: true,
      committeeTitle: 'Chair',
    },
  ])
  // A member of the other building with a resident row here as well: not this building's.
  const [stranger] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, 'stranger@test.example'))
  await db
    .insert(apartmentResidents)
    .values({ userId: stranger.id, apartmentId: ids.get('20') ?? '' })
}, 30_000)

/** The rows the database sent back for each query `run` makes, as text. */
async function rawRowsOf(run: () => Promise<unknown>): Promise<string> {
  const query = vi.spyOn(testDb.client, 'query')
  try {
    await run()
    expect(query).toHaveBeenCalledTimes(1)
    const results = await Promise.all(query.mock.results.map((result) => result.value))
    return JSON.stringify(results)
  } finally {
    query.mockRestore()
  }
}

describe('list', () => {
  it('never selects a contact its owner did not choose to show', async () => {
    signInAs(buildingId)

    const raw = await rawRowsOf(() => list(''))

    for (const value of hidden) expect(raw).not.toContain(value)
    expect(raw).toContain('050-1111111')
  })

  it('groups by floor, then apartment in natural order, then name', async () => {
    signInAs(buildingId)

    const floors = await list('')

    expect(
      floors.map(({ floor, apartments: rows }) => [
        floor,
        rows.map((a) => [a.number, a.residents.map((r) => r.name)]),
      ]),
    ).toEqual([
      [0, [['1', ['Dana Zur']]]],
      [
        1,
        [
          ['2', ['ana Levi', 'Ben Cohen']],
          ['2A', ['Eli Bar']],
          ['10', ['Chen Mor']],
        ],
      ],
      // Its only resident row belongs to another building's member: no one has joined.
      [2, [['20', []]]],
    ])
  })

  it('lists an apartment no one has joined, and never the other building’s resident in it', async () => {
    signInAs(buildingId)

    const raw = await rawRowsOf(() => list(''))

    expect(raw).not.toContain('Another Building Person')
    expect(raw).not.toContain('050-9999999')
    expect(raw).not.toContain('stranger@test.example')
    const floors = await list('')
    expect(floors.at(-1)).toEqual({
      floor: 2,
      apartments: [{ id: expect.any(String), number: '20', residents: [] }],
    })
  })

  it('finds an apartment no one has joined by its number, and hides it from a name search', async () => {
    signInAs(buildingId)

    expect((await list('20')).map((f) => f.apartments.map((a) => a.number))).toEqual([['20']])
    expect((await list('Levi')).flatMap((f) => f.apartments.map((a) => a.number))).toEqual(['2'])
  })

  it('shows a contact only when its owner opted in, and a blank phone as none', async () => {
    signInAs(buildingId)

    const residents = (await list('')).flatMap((f) => f.apartments.flatMap((a) => a.residents))
    const byName = new Map(residents.map((r) => [r.name, r]))

    expect(byName.get('ana Levi')).toEqual({
      userId: expect.any(String),
      name: 'ana Levi',
      isOwner: true,
      phone: '050-1111111',
      email: 'ana@shown.example',
    })
    expect(byName.get('Ben Cohen')).toMatchObject({ isOwner: false, phone: null, email: null })
    expect(byName.get('Dana Zur')).toMatchObject({ phone: null, email: 'dana@shown.example' })
    expect(byName.get('Eli Bar')).toMatchObject({ phone: null, email: 'eli@shown.example' })
  })

  it('is only the member’s own building, without another building’s members', async () => {
    signInAs(buildingId)
    const names = (await list('')).flatMap((f) =>
      f.apartments.flatMap((a) => a.residents.map((r) => r.name)),
    )
    expect(names).not.toContain('Another Building Person')

    signInAs(otherBuildingId)
    expect(await list('')).toEqual([
      {
        floor: 1,
        apartments: [
          {
            id: expect.any(String),
            number: '2',
            residents: [
              {
                userId: expect.any(String),
                name: 'Another Building Person',
                isOwner: false,
                phone: '050-9999999',
                email: 'stranger@test.example',
              },
            ],
          },
        ],
      },
    ])
  })

  it('finds residents by part of their name, in any case', async () => {
    signInAs(buildingId)

    const floors = await list('  LEVI ')

    expect(
      floors.map((f) => f.apartments.map((a) => [a.number, a.residents.map((r) => r.name)])),
    ).toEqual([[['2', ['ana Levi']]]])
  })

  it('finds an apartment’s residents by its exact number', async () => {
    signInAs(buildingId)

    const floors = await list('2a')

    expect(floors.map((f) => f.apartments.map((a) => a.number))).toEqual([['2A']])
  })

  it('is empty when nothing matches, taking LIKE wildcards literally', async () => {
    signInAs(buildingId)

    expect(await list('nobody')).toEqual([])
    expect(await list('%')).toEqual([])
  })
})

describe('committee', () => {
  it('never selects a member’s personal contact', async () => {
    signInAs(buildingId)

    const raw = await rawRowsOf(() => committee())

    for (const value of [...hidden, 'avi@hidden.example', '050-4444444', 'dana@shown.example']) {
      expect(raw).not.toContain(value)
    }
  })

  it('lists the chair first, then admins, then the committee, each by name', async () => {
    signInAs(buildingId)

    expect((await committee()).map((member) => member.name)).toEqual([
      'Chen Mor',
      'Avi Adam',
      'Dana Zur',
      'Eli Bar',
    ])
  })

  it('shows the committee contact whatever the personal opt-in', async () => {
    signInAs(buildingId)

    const [chair, , dana, treasurer] = await committee()

    // Chen hides their personal contact but publishes one for the role.
    expect(chair).toEqual({
      userId: expect.any(String),
      name: 'Chen Mor',
      role: 'committee',
      committeeTitle: 'יו"ר',
      committeePhone: '03-5550000',
      committeeEmail: 'chair@committee.example',
    })
    // Dana shows her personal contact, which stays on the directory.
    expect(dana).toMatchObject({ committeePhone: null, committeeEmail: null })
    expect(treasurer).toMatchObject({
      committeeTitle: 'Treasurer',
      committeePhone: null,
      committeeEmail: 'treasurer@committee.example',
    })
  })

  it.each([
    ['יו״ר הוועד', 'Secretary'],
    ['Chairperson', 'Treasurer'],
    ["יו''ר", 'Member'],
  ])('puts a chair titled “%s” first, before admins', async (chairTitle, otherTitle) => {
    const [own] = await db
      .insert(buildings)
      .values({ name: chairTitle, address: 'Chair 1', billingStartMonth: '2026-01' })
      .returning()
    await addPeople(own.id, new Map(), [
      { name: 'Amy', email: `amy-${own.id}@test.example`, phone: null, role: 'admin' },
      {
        name: 'Bea',
        email: `bea-${own.id}@test.example`,
        phone: null,
        role: 'committee',
        committeeTitle: otherTitle,
      },
      {
        name: 'Zed',
        email: `zed-${own.id}@test.example`,
        phone: null,
        role: 'committee',
        committeeTitle: chairTitle,
      },
    ])
    signInAs(own.id)

    expect((await committee()).map((member) => member.name)).toEqual(['Zed', 'Amy', 'Bea'])
  })

  it('is only the member’s own building', async () => {
    signInAs(otherBuildingId)

    expect((await committee()).map((member) => member.name)).toEqual(['Another Building Person'])
  })
})

// Someone who joined with an invite before saying their name (spec: `displayName`).
describe('people who joined without a name', () => {
  let namelessBuildingId: string

  // PGlite's migrations and seed can outlast the default 10 s on a busy machine.
  beforeAll(async () => {
    const [building] = await db
      .insert(buildings)
      .values({ name: 'Nameless', address: 'There 1', billingStartMonth: '2026-01' })
      .returning()
    namelessBuildingId = building.id
    const [apartment] = await db
      .insert(apartments)
      .values({ buildingId: namelessBuildingId, number: '5', floor: 1 })
      .returning()
    await addPeople(namelessBuildingId, new Map([['5', apartment.id]]), [
      { name: 'Zohar Named', email: 'zohar@shown.example', phone: null, apartment: '5' },
      { name: '', email: 'quiet@hidden.example', phone: null, apartment: '5' },
      {
        name: '  ',
        email: 'open@shown.example',
        phone: null,
        apartment: '5',
        showContact: true,
      },
      {
        name: '',
        email: 'treasurer@hidden.example',
        phone: null,
        role: 'committee',
        committeeEmail: 'money@committee.example',
      },
    ])
  }, 30_000)

  it('lists them in the directory after the named, never with an email they keep hidden', async () => {
    signInAs(namelessBuildingId)

    const [floor] = await list('')
    const residents = floor.apartments[0].residents

    const shown = residents.map(({ name, email }) => ({ name, email }))
    expect(shown[0]).toEqual({ name: 'Zohar Named', email: null })
    // The two without a name follow, in a stable order of their own.
    expect(shown.slice(1)).toHaveLength(2)
    expect(shown.slice(1)).toEqual(
      expect.arrayContaining([
        { name: null, email: 'open@shown.example' },
        { name: null, email: null },
      ]),
    )
    expect(await rawRowsOf(() => list(''))).not.toContain('quiet@hidden.example')
  })

  it('lists them on the committee page with no name and only the role’s contact', async () => {
    signInAs(namelessBuildingId)

    expect(await committee()).toEqual([
      {
        userId: expect.any(String),
        name: null,
        role: 'committee',
        committeeTitle: null,
        committeePhone: null,
        committeeEmail: 'money@committee.example',
      },
    ])
  })
})
