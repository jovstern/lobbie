import { and, eq, inArray, sql } from 'drizzle-orm'
import { createDbClient, type Db } from '@/app/lib/db-client'
import { requireEnv } from '@/app/lib/env'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  expenses,
  feeRates,
  payments,
  user,
} from '@/app/lib/schema'
import { addMonths, todayIn } from '@/app/lib/utils/dates'
import { logger } from '@/app/lib/logger'
import { isEntryPoint, runScript } from './run'

const timeZone = 'Asia/Jerusalem'
const defaultFee = 35_000
const penthouseFee = 45_000
const penthouses = new Set(['10', '11', '12'])
// Apartment number → how many of the latest months it has not paid.
const monthsBehind = new Map([
  ['4', 2],
  ['9', 3],
])
const methods = ['transfer', 'bit', 'cash', 'check'] as const

type Role = 'resident' | 'committee' | 'admin'
type Person = {
  email: string
  name: string
  phone: string
  apartment: string
  isOwner: boolean
  role: Role
  committeeTitle?: string
  showContact?: boolean
}

const people: Person[] = [
  {
    email: 'admin@example.com',
    name: 'מיכל אברהם',
    phone: '050-5550101',
    apartment: '1',
    isOwner: true,
    role: 'admin',
    showContact: true,
  },
  {
    email: 'resident1@example.com',
    name: 'יונתן אברהם',
    phone: '050-5550102',
    apartment: '1',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'committee1@example.com',
    name: 'דוד כהן',
    phone: '052-5550201',
    apartment: '2',
    isOwner: true,
    role: 'committee',
    committeeTitle: 'יו״ר',
    showContact: true,
  },
  {
    email: 'resident2@example.com',
    name: 'נועה לוי',
    phone: '054-5550301',
    apartment: '3',
    isOwner: false,
    role: 'resident',
    showContact: true,
  },
  {
    email: 'resident3@example.com',
    name: 'אבי מזרחי',
    phone: '050-5550401',
    apartment: '4',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'resident4@example.com',
    name: 'שרה פרץ',
    phone: '053-5550501',
    apartment: '5',
    isOwner: true,
    role: 'resident',
    showContact: true,
  },
  {
    email: 'resident5@example.com',
    name: 'משה פרץ',
    phone: '053-5550502',
    apartment: '5',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'committee2@example.com',
    name: 'רונית ביטון',
    phone: '052-5550601',
    apartment: '6',
    isOwner: true,
    role: 'committee',
    committeeTitle: 'גזבר',
    showContact: true,
  },
  {
    email: 'resident6@example.com',
    name: 'עומר דהן',
    phone: '054-5550701',
    apartment: '7',
    isOwner: false,
    role: 'resident',
  },
  {
    email: 'resident7@example.com',
    name: 'תמר אוחיון',
    phone: '050-5550801',
    apartment: '8',
    isOwner: false,
    role: 'resident',
    showContact: true,
  },
  {
    email: 'resident8@example.com',
    name: 'איתי אוחיון',
    phone: '050-5550802',
    apartment: '8',
    isOwner: false,
    role: 'resident',
  },
  {
    email: 'resident9@example.com',
    name: 'יעל גבאי',
    phone: '058-5550901',
    apartment: '9',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'resident10@example.com',
    name: 'אריאל שפירא',
    phone: '052-5551001',
    apartment: '10',
    isOwner: true,
    role: 'resident',
    showContact: true,
  },
  {
    email: 'resident11@example.com',
    name: 'חנה רוזן',
    phone: '054-5551101',
    apartment: '11',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'resident12@example.com',
    name: 'יוסף רוזן',
    phone: '054-5551102',
    apartment: '11',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'resident13@example.com',
    name: 'ליאור אלון',
    phone: '050-5551201',
    apartment: '12',
    isOwner: false,
    role: 'resident',
  },
  {
    email: 'e2e1@example.com',
    name: 'בודק אחד',
    phone: '050-5559001',
    apartment: 'e2e-1',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'e2e2@example.com',
    name: 'בודקת שתיים',
    phone: '050-5559002',
    apartment: 'e2e-2',
    isOwner: true,
    role: 'resident',
  },
  {
    email: 'e2e3@example.com',
    name: 'בודק שלוש',
    phone: '050-5559003',
    apartment: 'e2e-3',
    isOwner: true,
    role: 'resident',
  },
]

// Month offsets are relative to the current month; every date is in the past.
const expenseRows = [
  {
    category: 'cleaning',
    amount: 120_000,
    offset: -1,
    day: 3,
    description: 'ניקיון חדר מדרגות — חודשי',
  },
  {
    category: 'cleaning',
    amount: 120_000,
    offset: -4,
    day: 3,
    description: 'ניקיון חדר מדרגות — חודשי',
  },
  {
    category: 'cleaning',
    amount: 120_000,
    offset: -8,
    day: 3,
    description: 'ניקיון חדר מדרגות — חודשי',
  },
  { category: 'garden', amount: 45_000, offset: -2, day: 12, description: 'גיזום וטיפוח הגינה' },
  { category: 'garden', amount: 38_000, offset: -7, day: 15, description: 'שתילת עונה' },
  { category: 'elevator', amount: 95_000, offset: -3, day: 8, description: 'טיפול תקופתי במעלית' },
  { category: 'elevator', amount: 210_000, offset: -9, day: 20, description: 'החלפת כבלי מעלית' },
  {
    category: 'electricity',
    amount: 31_500,
    offset: -1,
    day: 18,
    description: 'חשבון חשמל — שטחים משותפים',
  },
  {
    category: 'electricity',
    amount: 29_800,
    offset: -5,
    day: 18,
    description: 'חשבון חשמל — שטחים משותפים',
  },
  { category: 'water', amount: 14_200, offset: -2, day: 22, description: 'חשבון מים — גינה' },
  { category: 'water', amount: 12_900, offset: -6, day: 22, description: 'חשבון מים — גינה' },
  { category: 'repairs', amount: 68_000, offset: -3, day: 26, description: 'תיקון דלת הכניסה' },
  { category: 'repairs', amount: 24_500, offset: -10, day: 5, description: 'החלפת נורות בלובי' },
  { category: 'insurance', amount: 340_000, offset: -11, day: 1, description: 'ביטוח מבנה — שנתי' },
  { category: 'other', amount: 18_000, offset: -6, day: 9, description: 'שלט כניסה חדש' },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Seeds the demo building. Idempotent: people, apartments, memberships and residents are
 * upserted on their natural keys; the demo building's fees, payments and expenses (which
 * have no natural key, and are relative to the current month) are replaced as a whole.
 * Everything runs in one transaction.
 */
export async function seed(db: Db, { now = new Date() }: { now?: Date } = {}): Promise<void> {
  const today = todayIn(timeZone, now)
  const currentMonth = today.slice(0, 7)
  const todayDay = Number(today.slice(8))
  const billingStartMonth = addMonths(currentMonth, -12)
  const billedMonths = Array.from({ length: 13 }, (_, i) => addMonths(billingStartMonth, i))

  await db.transaction(async (tx) => {
    const demo = {
      name: 'רחוב הרימון 12',
      address: 'הרימון 12, רמת גן',
      timezone: timeZone,
      quorumPercent: 50,
      openingBalanceAgorot: 850_000,
      billingStartMonth,
      isDemo: true,
    }
    const [existing] = await tx
      .select({ id: buildings.id })
      .from(buildings)
      .where(and(eq(buildings.name, demo.name), eq(buildings.isDemo, true)))
    const [building] = existing
      ? await tx.update(buildings).set(demo).where(eq(buildings.id, existing.id)).returning()
      : await tx.insert(buildings).values(demo).returning()
    const buildingId = building.id

    await tx.delete(payments).where(eq(payments.buildingId, buildingId))
    await tx.delete(expenses).where(eq(expenses.buildingId, buildingId))
    await tx.delete(feeRates).where(eq(feeRates.buildingId, buildingId))

    const apartmentRows = [
      ...Array.from({ length: 12 }, (_, i) => ({
        buildingId,
        number: String(i + 1),
        floor: Math.ceil((i + 1) / 3),
        billingStartMonth: null,
      })),
      // e2e apartments owe only the current month, so write tests start from a known state.
      ...[1, 2, 3].map((n) => ({
        buildingId,
        number: `e2e-${n}`,
        floor: 0,
        billingStartMonth: currentMonth,
      })),
    ]
    const savedApartments = await tx
      .insert(apartments)
      .values(apartmentRows)
      .onConflictDoUpdate({
        target: [apartments.buildingId, apartments.number],
        set: {
          floor: sql`excluded.floor`,
          billingStartMonth: sql`excluded.billing_start_month`,
        },
      })
      .returning({ id: apartments.id, number: apartments.number })
    const apartmentId = new Map(savedApartments.map((a) => [a.number, a.id]))

    // A seed email that already belongs to another building's member is left as it is.
    const notInAnotherBuilding = sql`NOT EXISTS (
      SELECT 1 FROM ${buildingMembers}
      WHERE ${buildingMembers.userId} = ${user.id} AND ${buildingMembers.buildingId} <> ${buildingId}
    )`
    await tx
      .insert(user)
      .values(
        people.map((p) => ({ name: p.name, email: p.email, phone: p.phone, emailVerified: true })),
      )
      .onConflictDoUpdate({
        target: user.email,
        set: { name: sql`excluded.name`, phone: sql`excluded.phone` },
        setWhere: notInAnotherBuilding,
      })
    const savedUsers = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        inArray(
          user.email,
          people.map((p) => p.email),
        ),
      )
    const userId = new Map(savedUsers.map((u) => [u.email, u.id]))
    const idOf = <K>(map: Map<K, string>, key: K) => {
      const id = map.get(key)
      if (id === undefined) throw new Error(`seed: no row for ${String(key)}`)
      return id
    }

    const savedMembers = await tx
      .insert(buildingMembers)
      .values(
        people.map((p) => ({
          userId: idOf(userId, p.email),
          buildingId,
          role: p.role,
          committeeTitle: p.committeeTitle ?? null,
          showContact: p.showContact ?? false,
          committeePhone: p.committeeTitle ? p.phone : null,
          committeeEmail: p.committeeTitle ? p.email : null,
        })),
      )
      // Only rows already in the demo building are updated: a member elsewhere never moves.
      .onConflictDoUpdate({
        target: buildingMembers.userId,
        setWhere: eq(buildingMembers.buildingId, buildingId),
        set: {
          role: sql`excluded.role`,
          committeeTitle: sql`excluded.committee_title`,
          showContact: sql`excluded.show_contact`,
          committeePhone: sql`excluded.committee_phone`,
          committeeEmail: sql`excluded.committee_email`,
        },
      })
      .returning({ userId: buildingMembers.userId })
    const demoMembers = new Set(savedMembers.map((m) => m.userId))

    await tx
      .insert(apartmentResidents)
      .values(
        people
          .filter((p) => demoMembers.has(idOf(userId, p.email)))
          .map((p) => ({
            userId: idOf(userId, p.email),
            apartmentId: idOf(apartmentId, p.apartment),
            isOwner: p.isOwner,
          })),
      )
      .onConflictDoUpdate({
        target: [apartmentResidents.userId, apartmentResidents.apartmentId],
        set: { isOwner: sql`excluded.is_owner` },
      })

    const treasurer = idOf(userId, 'committee2@example.com')

    await tx.insert(feeRates).values([
      {
        buildingId,
        apartmentId: null,
        amountAgorot: defaultFee,
        effectiveFrom: billingStartMonth,
        createdBy: treasurer,
      },
      ...[...penthouses].map((number) => ({
        buildingId,
        apartmentId: idOf(apartmentId, number),
        amountAgorot: penthouseFee,
        effectiveFrom: billingStartMonth,
        createdBy: treasurer,
      })),
    ])

    const paymentRows: (typeof payments.$inferInsert)[] = []
    for (let n = 1; n <= 12; n++) {
      const number = String(n)
      const paidMonths = billedMonths.slice(
        0,
        billedMonths.length - (monthsBehind.get(number) ?? 0),
      )
      for (const month of paidMonths) {
        const day = month === currentMonth ? Math.min(1 + (n % 9), todayDay) : 1 + (n % 9)
        paymentRows.push({
          buildingId,
          apartmentId: idOf(apartmentId, number),
          month,
          amountAgorot: penthouses.has(number) ? penthouseFee : defaultFee,
          paidOn: `${month}-${pad(day)}`,
          method: methods[n % methods.length],
          recordedBy: treasurer,
        })
      }
    }
    const voidedMonth = billedMonths[3]
    paymentRows.push({
      buildingId,
      apartmentId: idOf(apartmentId, '2'),
      month: voidedMonth,
      amountAgorot: defaultFee,
      paidOn: `${voidedMonth}-04`,
      method: 'cash',
      note: 'מזומן לגזברית',
      recordedBy: treasurer,
      voidedAt: now,
      voidedBy: treasurer,
      voidReason: 'נרשם פעמיים בטעות',
    })
    await tx.insert(payments).values(paymentRows)

    await tx.insert(expenses).values(
      expenseRows.map((e) => ({
        buildingId,
        category: e.category,
        amountAgorot: e.amount,
        spentOn: `${addMonths(currentMonth, e.offset)}-${pad(e.day)}`,
        description: e.description,
        recordedBy: treasurer,
      })),
    )
  })
}

if (isEntryPoint(import.meta.url)) {
  void runScript('db:seed', async () => {
    const { db, close } = createDbClient(requireEnv('DATABASE_URL'))
    try {
      await seed(db)
      // Building rows, fee rates and balances are cached for hours ('use cache'), and the
      // seed writes behind the app's back, so no tag is updated.
      logger.info('db:seed: restart any running server to drop its cached building data')
    } finally {
      await close()
    }
  })
}
