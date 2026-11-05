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
