import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import ApartmentsAdmin from '@/app/ui/admin/apartments-admin'
import { ApartmentsSkeleton } from '@/app/ui/skeletons'

// The role first: below it the page is a 404, and its title must not name the page. (The
// status stays 200: with Cache Components the session can only be read inside <Suspense>,
// so the shell has streamed by then, and the status with it.)
export async function generateMetadata(): Promise<Metadata> {
  const [, t] = await Promise.all([requireRole('admin'), getTranslations('AdminApartments')])
  return { title: t('title') }
}

// Admins only (★): ApartmentsAdmin checks the role and answers 404 to anyone else.
export default function AdminApartmentsPage() {
  return (
    <Suspense fallback={<ApartmentsSkeleton />}>
      <ApartmentsAdmin />
    </Suspense>
  )
}
