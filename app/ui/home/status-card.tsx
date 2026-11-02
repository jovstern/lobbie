import { requireMember } from '@/app/lib/authz'
import { statusForApartments } from '@/app/lib/data/payments'
import { currentMonthIn } from '@/app/lib/utils/dates'
import StatusSummary from '@/app/ui/home/status-summary'

/** The member's own apartments only: ids come from their membership, never from the URL. */
export default async function StatusCard() {
  const { buildingId, apartmentIds, timeZone } = await requireMember()
  // One instant for both the statuses and the month named beside them.
  const now = new Date()
  const statuses = await statusForApartments(buildingId, apartmentIds, now)

  return (
    <StatusSummary
      month={currentMonthIn(timeZone, now)}
      apartments={[...statuses].map(([id, status]) => ({ id, status }))}
    />
  )
}
