import postgres from 'postgres'
import { z } from 'zod'

/**
 * The demo building's fund, computed straight from the test database: an oracle independent of
 * the app's own query. The seed is relative to today, so the figure is never hard-coded.
 */
export async function demoBuildingBalanceAgorot(): Promise<number> {
  const url = process.env.E2E_DATABASE_URL
  if (!url) throw new Error('E2E_DATABASE_URL is not set.')
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  try {
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
      WHERE b.is_demo`
    return z.coerce.number().int().parse(row?.total)
  } finally {
    await sql.end()
  }
}
