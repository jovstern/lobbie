import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import ApartmentsAdmin from '@/app/ui/admin/apartments-admin'
import { ApartmentsSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminApartments')
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
