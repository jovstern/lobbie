import postgres from 'postgres'
import { z } from 'zod'
import { demoBuildingId } from '@/scripts/demo-building'

/** Runs `fn` with a one-connection client to the e2e test database, closed afterwards. */
export async function withE2eSql<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL
  if (!url) throw new Error('E2E_DATABASE_URL is not set.')
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  try {
    return await fn(sql)
  } finally {
    await sql.end()
  }
}

/**
 * The demo building's fund, computed straight from the test database: an oracle independent of
 * the app's own query. The seed is relative to today, so the figure is never hard-coded.
 */
export async function demoBuildingBalanceAgorot(): Promise<number> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT (
        b.opening_balance_agorot
        + coalesce((SELECT sum(amount_agorot) FROM balance_adjustments WHERE building_id = b.id), 0)
        + coalesce((SELECT sum(amount_agorot) FROM payments
                    WHERE building_id = b.id AND voided_at IS NULL), 0)
        - coalesce((SELECT sum(amount_agorot) FROM expenses
                    WHERE building_id = b.id AND voided_at IS NULL), 0)
      )::text AS total
      FROM buildings b
      WHERE b.id = ${demoBuildingId}`
    return z.coerce.number().int().parse(row?.total)
  })
}

/** Removes the balance adjustments a test recorded, found by their reason. */
export async function deleteAdjustmentsWithReason(reason: string): Promise<void> {
  await withE2eSql((sql) => sql`DELETE FROM balance_adjustments WHERE reason = ${reason}`)
}

/** Removes a demo-building apartment a test added, by its number; nothing points at it. */
export async function deleteApartmentNumbered(number: string): Promise<void> {
  await withE2eSql(
    (sql) =>
      sql`DELETE FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}`,
  )
}

/** How many people live in a demo-building apartment, read straight from the test database. */
export async function residentCountOf(number: string): Promise<number> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT count(*)::int AS residents
      FROM apartment_residents r
      JOIN apartments a ON a.id = r.apartment_id
      WHERE a.building_id = ${demoBuildingId} AND a.number = ${number}`
    return z.number().int().parse(row?.residents)
  })
}

/** The id of a demo-building apartment, by its number. */
export async function apartmentIdOf(number: string): Promise<string> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}`
    return z.uuid().parse(row?.id)
  })
}

/** Removes every invite of a demo-building apartment, by its number. */
export async function deleteInvitesOf(number: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      DELETE FROM invites
      WHERE apartment_id = (
        SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
      )`,
  )
}

/** Removes every invite of the demo building, as "Create invites for all" leaves them. */
export async function deleteDemoInvites(): Promise<void> {
  await withE2eSql((sql) => sql`DELETE FROM invites WHERE building_id = ${demoBuildingId}`)
}

/** Removes a person a test created, with their membership, apartments and sessions. */
export async function deleteUser(email: string): Promise<void> {
  await withE2eSql((sql) =>
    sql.begin(async (tx) => {
      const users = tx`SELECT id FROM "user" WHERE email = ${email}`
      await tx`DELETE FROM apartment_residents WHERE user_id IN (${users})`
      await tx`DELETE FROM building_members WHERE user_id IN (${users})`
      // Sessions and accounts go with the user (ON DELETE CASCADE).
      await tx`DELETE FROM "user" WHERE email = ${email}`
    }),
  )
}

/** Puts a demo-building member back to a resident without a title, as the seed has them. */
export async function resetToResident(email: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      UPDATE building_members SET role = 'resident', committee_title = NULL
      WHERE building_id = ${demoBuildingId}
        AND user_id = (SELECT id FROM "user" WHERE email = ${email})`,
  )
}

/** Sets whether someone owns a demo-building apartment, by their email and its number. */
export async function setOwner(email: string, number: string, isOwner: boolean): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      UPDATE apartment_residents SET is_owner = ${isOwner}
      WHERE user_id = (SELECT id FROM "user" WHERE email = ${email})
        AND apartment_id = (
          SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
        )`,
  )
}

/** Someone new living in a demo-building apartment, for a test that removes them. */
export async function addResident(email: string, name: string, number: string): Promise<void> {
  await withE2eSql((sql) =>
    sql.begin(async (tx) => {
      const [person] = await tx`
        INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
        VALUES (gen_random_uuid(), ${name}, ${email}, true, now(), now())
        RETURNING id`
      await tx`
        INSERT INTO building_members (user_id, building_id) VALUES (${person.id}, ${demoBuildingId})`
      await tx`
        INSERT INTO apartment_residents (user_id, apartment_id)
        SELECT ${person.id}, id FROM apartments
        WHERE building_id = ${demoBuildingId} AND number = ${number}`
    }),
  )
}

/** Whether someone is still a member of a building, read straight from the test database. */
export async function isMember(email: string): Promise<boolean> {
  return withE2eSql(async (sql) => {
    const rows = await sql`
      SELECT 1 FROM building_members
      WHERE user_id = (SELECT id FROM "user" WHERE email = ${email})`
    return rows.length > 0
  })
}

/** Sets a demo-building member's own phone (E.164) and directory choice, by their email. */
export async function setContact(
  email: string,
  { phone, showContact }: { phone: string | null; showContact: boolean },
): Promise<void> {
  await withE2eSql((sql) =>
    sql.begin(async (tx) => {
      await tx`UPDATE "user" SET phone = ${phone} WHERE email = ${email}`
      await tx`
        UPDATE building_members SET show_contact = ${showContact}
        WHERE building_id = ${demoBuildingId}
          AND user_id = (SELECT id FROM "user" WHERE email = ${email})`
    }),
  )
}

/** Sets the contact a demo-building committee member publishes, by their email. */
export async function setCommitteeContact(
  email: string,
  contact: { phone: string | null; email: string | null },
): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      UPDATE building_members
      SET committee_phone = ${contact.phone}, committee_email = ${contact.email}
      WHERE building_id = ${demoBuildingId}
        AND user_id = (SELECT id FROM "user" WHERE email = ${email})`,
  )
}

/** The language saved to someone's profile. */
export async function savedLocaleOf(email: string): Promise<string | null> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`SELECT locale FROM "user" WHERE email = ${email}`
    return z
      .string()
      .nullable()
      .parse(row?.locale ?? null)
  })
}

/** Sets the language saved to someone's profile (the seed saves Hebrew). */
export async function setSavedLocaleOf(email: string, locale: 'he' | 'en'): Promise<void> {
  await withE2eSql((sql) => sql`UPDATE "user" SET locale = ${locale} WHERE email = ${email}`)
}

/** Removes every fee of its own a demo-building apartment has, by its number. */
export async function deleteFeesOf(number: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      DELETE FROM fee_rates
      WHERE apartment_id = (
        SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
      )`,
  )
}

/** How many default fees the demo building has from `month`, read straight from the database. */
export async function buildingFeeCountFrom(month: string): Promise<number> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT count(*)::int AS rates FROM fee_rates
      WHERE building_id = ${demoBuildingId} AND apartment_id IS NULL AND effective_from = ${month}`
    return z.number().int().parse(row?.rates)
  })
}

/**
 * Gives a demo-building apartment a fee of its own from `month`, set by the treasurer as the
 * seed's fees are, for a test that then ends it.
 */
export async function addOwnFee(number: string, amountAgorot: number, month: string) {
  await withE2eSql(
    (sql) => sql`
      INSERT INTO fee_rates (building_id, apartment_id, amount_agorot, effective_from, created_by)
      SELECT ${demoBuildingId}, a.id, ${amountAgorot}, ${month}, u.id
      FROM apartments a, "user" u
      WHERE a.building_id = ${demoBuildingId} AND a.number = ${number}
        AND u.email = 'committee2@example.com'`,
  )
}

/**
 * Sets the month a demo-building apartment's billing starts, by its number; null follows the
 * building's. The seed starts the e2e apartments this month. Read fresh by every page (only
 * the building's billing is cached), so a cleanup here leaves no stale copy behind.
 */
export async function setBillingStart(number: string, month: string | null): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      UPDATE apartments SET billing_start_month = ${month}
      WHERE building_id = ${demoBuildingId} AND number = ${number}`,
  )
}

/** Removes every payment of a demo-building apartment, voided or not, by its number. */
export async function deletePaymentsOf(number: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      DELETE FROM payments
      WHERE apartment_id = (
        SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
      )`,
  )
}

/** How many payments a demo-building apartment has for a month, voided or not. */
export async function paymentCountOf(number: string, month: string): Promise<number> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT count(*)::int AS payments FROM payments p
      JOIN apartments a ON a.id = p.apartment_id
      WHERE a.building_id = ${demoBuildingId} AND a.number = ${number} AND p.month = ${month}`
    return z.number().int().parse(row?.payments)
  })
}

/**
 * Records a payment for a demo-building apartment straight in the test database, as the
 * treasurer, voided with `voidReason` when one is given. Payments are read fresh by every page
 * (never from a cache), so removing them with `deletePaymentsOf` leaves no stale copy behind.
 */
export async function addPayment(
  number: string,
  payment: {
    month: string
    amountAgorot: number
    paidOn: string
    method: 'cash' | 'transfer' | 'check' | 'bit' | 'other'
    voidReason?: string
  },
): Promise<void> {
  const voidReason = payment.voidReason ?? null
  await withE2eSql(
    (sql) => sql`
      INSERT INTO payments
        (building_id, apartment_id, month, amount_agorot, paid_on, method, recorded_by,
         voided_at, voided_by, void_reason)
      SELECT ${demoBuildingId}, a.id, ${payment.month}, ${payment.amountAgorot}, ${payment.paidOn},
        ${payment.method}, u.id,
        CASE WHEN ${voidReason}::text IS NULL THEN NULL ELSE now() END,
        CASE WHEN ${voidReason}::text IS NULL THEN NULL ELSE u.id END,
        ${voidReason}
      FROM apartments a, "user" u
      WHERE a.building_id = ${demoBuildingId} AND a.number = ${number}
        AND u.email = 'committee2@example.com'`,
  )
}

/** Makes someone also live in a demo-building apartment, by their email and its number. */
export async function addResidence(email: string, number: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      INSERT INTO apartment_residents (user_id, apartment_id)
      SELECT u.id, a.id FROM "user" u, apartments a
      WHERE u.email = ${email} AND a.building_id = ${demoBuildingId} AND a.number = ${number}
      ON CONFLICT DO NOTHING`,
  )
}

/** Takes someone out of a demo-building apartment, by their email and its number. */
export async function removeResidence(email: string, number: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      DELETE FROM apartment_residents
      WHERE user_id = (SELECT id FROM "user" WHERE email = ${email})
        AND apartment_id = (
          SELECT id FROM apartments WHERE building_id = ${demoBuildingId} AND number = ${number}
        )`,
  )
}

/** The storage key of the receipt of a demo-building expense, by its description; null without. */
export async function receiptKeyOf(description: string): Promise<string | null> {
  return withE2eSql(async (sql) => {
    const [row] = await sql`
      SELECT receipt_key FROM expenses
      WHERE building_id = ${demoBuildingId} AND description = ${description}`
    return z
      .string()
      .nullable()
      .parse(row?.receipt_key ?? null)
  })
}

/** Whether a demo-building expense, by its description, exists and still counts. */
export async function expenseCounts(description: string): Promise<boolean> {
  return withE2eSql(async (sql) => {
    const rows = await sql`
      SELECT 1 FROM expenses
      WHERE building_id = ${demoBuildingId} AND description = ${description} AND voided_at IS NULL`
    return rows.length > 0
  })
}

/**
 * Voids a demo-building expense, by its description, straight in the test database, as the
 * treasurer. Behind the app's back: the cached fund keeps counting it until a write updates the
 * building's tag, so the caller must make one.
 */
export async function voidExpenseInDb(description: string): Promise<void> {
  await withE2eSql(
    (sql) => sql`
      UPDATE expenses
      SET voided_at = now(), void_reason = 'e2e cleanup',
        voided_by = (SELECT id FROM "user" WHERE email = 'committee2@example.com')
      WHERE building_id = ${demoBuildingId} AND description = ${description}
        AND voided_at IS NULL`,
  )
}

/**
 * The demo building's expenses that count in a year, by category, straight from the test
 * database: the oracle for `/money/balance`'s bars.
 */
export async function demoExpensesByCategory(
  year: number,
): Promise<{ category: string; amountAgorot: number }[]> {
  return withE2eSql(async (sql) => {
    const rows = await sql`
      SELECT category::text AS category, sum(amount_agorot)::text AS amount_agorot
      FROM expenses
      WHERE building_id = ${demoBuildingId}
        AND voided_at IS NULL
        AND spent_on BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
      GROUP BY category`
    return z
      .array(z.object({ category: z.string(), amount_agorot: z.coerce.number().int() }))
      .parse(rows)
      .map(({ category, amount_agorot }) => ({ category, amountAgorot: amount_agorot }))
  })
}
