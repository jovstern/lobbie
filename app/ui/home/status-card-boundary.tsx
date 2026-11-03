import { Suspense } from 'react'
import { requireMember } from '@/app/lib/authz'
import StatusCard, { preloadStatuses } from '@/app/ui/home/status-card'
import { StatusCardSkeleton } from '@/app/ui/skeletons'

/**
 * The membership arrives before the statuses, and says how many apartments there are: the
 * skeleton takes that shape while the statuses load. Both reads start together, so Home's
 * status costs one database round trip, not two.
 */
export default async function StatusCardBoundary() {
  preloadStatuses()
  const { apartmentIds } = await requireMember()

  return (
    <Suspense fallback={<StatusCardSkeleton apartments={apartmentIds.length} />}>
      <StatusCard />
    </Suspense>
  )
}
