import { Suspense } from 'react'
import { requireMember } from '@/app/lib/authz'
import StatusCard from '@/app/ui/home/status-card'
import { StatusCardSkeleton } from '@/app/ui/skeletons'

/**
 * The membership arrives before the statuses, and says how many apartments there are: the
 * skeleton takes that shape while the statuses load.
 */
export default async function StatusCardBoundary() {
  const { apartmentIds } = await requireMember()

  return (
    <Suspense fallback={<StatusCardSkeleton apartments={apartmentIds.length} />}>
      <StatusCard />
    </Suspense>
  )
}
