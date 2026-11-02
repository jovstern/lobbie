import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export * from './auth-schema'

// Columns are camelCase in TypeScript and snake_case in SQL (`casing` is not used, so each
// name is explicit and matches the migrations exactly).

const monthPattern = sql.raw(`'^\\d{4}-(0[1-9]|1[0-2])$'`)

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const month = (name: string) => char(name, { length: 7 })

export const roleEnum = pgEnum('role', ['resident', 'committee', 'admin'])
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'transfer',
  'check',
  'bit',
  'other',
])
export const expenseCategoryEnum = pgEnum('expense_category', [
  'cleaning',
  'garden',
  'elevator',
  'electricity',
  'water',
  'repairs',
  'insurance',
  'other',
])

export const buildings = pgTable(
  'buildings',
  {
    id: id(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    timezone: text('timezone').notNull().default('Asia/Jerusalem'),
    quorumPercent: integer('quorum_percent').notNull().default(50),
    openingBalanceAgorot: integer('opening_balance_agorot').notNull().default(0),
    billingStartMonth: month('billing_start_month').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check('buildings_quorum_percent_range', sql`${t.quorumPercent} BETWEEN 1 AND 100`),
    check('buildings_opening_balance_non_negative', sql`${t.openingBalanceAgorot} >= 0`),
    check('buildings_billing_start_month_format', sql`${t.billingStartMonth} ~ ${monthPattern}`),
  ],
)

export const balanceAdjustments = pgTable(
  'balance_adjustments',
  {
    id: id(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    amountAgorot: integer('amount_agorot').notNull(),
    reason: text('reason').notNull(),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('balance_adjustments_amount_non_zero', sql`${t.amountAgorot} <> 0`),
    index('balance_adjustments_building_id_idx').on(t.buildingId),
  ],
)

export const apartments = pgTable(
  'apartments',
  {
    id: id(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    number: text('number').notNull(),
    floor: integer('floor').notNull(),
    billingStartMonth: month('billing_start_month'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('apartments_building_id_number_unique').on(t.buildingId, t.number),
    // The target of the composite FKs that keep apartment references inside one building.
    unique('apartments_id_building_id_unique').on(t.id, t.buildingId),
    check('apartments_billing_start_month_format', sql`${t.billingStartMonth} ~ ${monthPattern}`),
  ],
)

export const buildingMembers = pgTable(
  'building_members',
  {
    id: id(),
    // Unique: one building per user in v1 (spec §3).
    userId: uuid('user_id')
      .notNull()
      .unique('building_members_user_id_unique')
      .references(() => user.id, { onDelete: 'restrict' }),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    role: roleEnum('role').notNull().default('resident'),
    committeeTitle: text('committee_title'),
    showContact: boolean('show_contact').notNull().default(false),
    committeePhone: text('committee_phone'),
    committeeEmail: text('committee_email'),
    createdAt: createdAt(),
  },
  (t) => [index('building_members_building_id_idx').on(t.buildingId)],
)

export const apartmentResidents = pgTable(
  'apartment_residents',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id')
      .notNull()
      .references(() => apartments.id, { onDelete: 'restrict' }),
    isOwner: boolean('is_owner').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'apartment_residents_pk', columns: [t.userId, t.apartmentId] }),
    index('apartment_residents_apartment_id_idx').on(t.apartmentId),
  ],
)

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'rate_limits_pk', columns: [t.key, t.windowStart] }),
    // Pruning deletes by window_start alone, which the primary key (key first) cannot serve.
    index('rate_limits_window_start_idx').on(t.windowStart),
  ],
)

export const feeRates = pgTable(
  'fee_rates',
  {
    id: id(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    // Null is the building default; a value is that apartment's override.
    apartmentId: uuid('apartment_id'),
    amountAgorot: integer('amount_agorot').notNull(),
    effectiveFrom: month('effective_from').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('fee_rates_building_apartment_effective_from_unique')
      .on(t.buildingId, t.apartmentId, t.effectiveFrom)
      .nullsNotDistinct(),
    foreignKey({
      name: 'fee_rates_apartment_building_fk',
      columns: [t.apartmentId, t.buildingId],
      foreignColumns: [apartments.id, apartments.buildingId],
    }).onDelete('restrict'),
    index('fee_rates_building_id_effective_from_idx').on(t.buildingId, t.effectiveFrom),
    check('fee_rates_amount_positive', sql`${t.amountAgorot} > 0`),
    check('fee_rates_effective_from_format', sql`${t.effectiveFrom} ~ ${monthPattern}`),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: id(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id').notNull(),
    month: month('month').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    paidOn: date('paid_on').notNull(),
    method: paymentMethodEnum('method').notNull(),
    note: text('note'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => user.id, { onDelete: 'restrict' }),
    voidReason: text('void_reason'),
  },
  (t) => [
    foreignKey({
      name: 'payments_apartment_building_fk',
      columns: [t.apartmentId, t.buildingId],
      foreignColumns: [apartments.id, apartments.buildingId],
    }).onDelete('restrict'),
    index('payments_apartment_id_month_idx').on(t.apartmentId, t.month),
    index('payments_building_id_month_idx').on(t.buildingId, t.month),
    check('payments_amount_positive', sql`${t.amountAgorot} > 0`),
    check('payments_month_format', sql`${t.month} ~ ${monthPattern}`),
    check(
      'payments_void_all_or_none',
      sql`(${t.voidedAt} IS NULL AND ${t.voidedBy} IS NULL AND ${t.voidReason} IS NULL)
        OR (${t.voidedAt} IS NOT NULL AND ${t.voidedBy} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`,
    ),
  ],
)

export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'restrict' }),
    category: expenseCategoryEnum('category').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    spentOn: date('spent_on').notNull(),
    description: text('description').notNull(),
    receiptKey: text('receipt_key'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => user.id, { onDelete: 'restrict' }),
    voidReason: text('void_reason'),
  },
  (t) => [
    index('expenses_building_id_spent_on_idx').on(t.buildingId, t.spentOn),
    check('expenses_amount_positive', sql`${t.amountAgorot} > 0`),
    check(
      'expenses_void_all_or_none',
      sql`(${t.voidedAt} IS NULL AND ${t.voidedBy} IS NULL AND ${t.voidReason} IS NULL)
        OR (${t.voidedAt} IS NOT NULL AND ${t.voidedBy} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`,
    ),
  ],
)
