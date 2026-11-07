import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import PaymentsBoard from '@/app/ui/admin/payments-board'
import { PaymentsBoardSkeleton } from '@/app/ui/skeletons'

/** The page's heading, which takes focus when the button a dialog opened from is gone. */
const headingId = 'payments-title'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * `/admin/payments` for the committee and up (R15, R17): its header as soon as the role is
 * known, then the board (who is behind, the grid, the open apartment) as it is read.
 */
export default async function PaymentsAdmin({ searchParams }: Props) {
  // The committee and up; anyone else gets the 404, before anything of the building is read.
  await requireRole('committee')
  const t = await getTranslations('AdminPayments')

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <AdminAnnouncer
      headingId={headingId}
      header={<AdminPageHeader title={t('title')} lead={t('lead')} headingId={headingId} />}
    >
      {/* Not keyed by the URL: moving between years or apartments keeps the board on screen
          until the next one is read, instead of flashing the skeleton. */}
      <Suspense fallback={<PaymentsBoardSkeleton />}>
        <PaymentsBoard searchParams={searchParams} />
      </Suspense>
    </AdminAnnouncer>
  )
}
