import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import ApartmentsAdmin, { apartmentsHeadingId } from '@/app/ui/admin/apartments-admin'
import { ApartmentsSkeleton } from '@/app/ui/skeletons'

// The role first: below it the page is a 404, and its title must not name the page. (The
// status stays 200: with Cache Components the session can only be read inside <Suspense>,
// so the shell has streamed by then, and the status with it.)
export async function generateMetadata(): Promise<Metadata> {
  const [, t] = await Promise.all([requireRole('admin'), getTranslations('AdminApartments')])
  return { title: t('title') }
}

// Admins only (★): ApartmentsAdmin checks the role and answers 404 to anyone else.
export default async function AdminApartmentsPage() {
  const t = await getTranslations('AdminApartments')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} lead={t('lead')} headingId={apartmentsHeadingId} />
      <Suspense fallback={<ApartmentsSkeleton />}>
        <ApartmentsAdmin />
      </Suspense>
    </div>
  )
}
