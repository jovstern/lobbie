import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { get } from '@/app/lib/data/apartments'
import { Suspense } from 'react'
import ApartmentDetails from '@/app/ui/admin/apartment-details'
import { ApartmentPageSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/apartments/[id]'>): Promise<Metadata> {
  const { id } = await params
  // The same read as the header's, once per request; an admin-only 404 for anyone else.
  const [apartment, t] = await Promise.all([get(id), getTranslations('AdminApartments')])
  return { title: apartment ? t('apartmentTitle', { number: apartment.number }) : t('title') }
}

// Admins only (★): ApartmentDetails checks the role and answers 404 to anyone else, and to an
// id that is not one of the building's apartments.
export default function AdminApartmentPage({
  params,
}: PageProps<'/[locale]/admin/apartments/[id]'>) {
  return (
    <Suspense fallback={<ApartmentPageSkeleton />}>
      <ApartmentDetails apartmentId={params.then(({ id }) => id)} />
    </Suspense>
  )
}
