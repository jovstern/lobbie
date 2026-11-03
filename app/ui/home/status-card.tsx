import { cache } from 'react'
import { requireMember } from '@/app/lib/authz'
import { statusForUser } from '@/app/lib/data/payments'
import type { ApartmentStatus } from '@/app/lib/definitions'
import { getSession } from '@/app/lib/session'
import { currentMonthIn } from '@/app/lib/utils/dates'
import StatusSummary from '@/app/ui/home/status-summary'

/**
 * The signed-in person's statuses, once per request. The user id comes from the session
 * (read from its cookie, no database), so this need not wait for the membership; one instant
 * serves both the statuses and the month named beside them.
 */
const loadStatuses = cache(async () => {
  // The session reads the request first, so the clock is read at request time, not prerender.
  const session = await getSession()
  const now = new Date()
  // Signed out: requireMember, awaited beside this, redirects to sign-in.
  return {
    now,
    statuses: session
      ? await statusForUser(session.user.id, now)
      : new Map<string, ApartmentStatus>(),
  }
})

/** Starts the statuses' read without waiting for it; `StatusCard` picks up the same promise. */
export function preloadStatuses() {
  // The card awaits and reports any failure; this copy only must not count as unhandled.
  loadStatuses().catch(() => {})
}

/** The member's own apartments only: the query starts from their user id, never the URL. */
export default async function StatusCard() {
  const [{ timeZone }, { now, statuses }] = await Promise.all([requireMember(), loadStatuses()])

  return (
    <StatusSummary
      month={currentMonthIn(timeZone, now)}
      apartments={[...statuses].map(([id, status]) => ({ id, status }))}
    />
  )
}
