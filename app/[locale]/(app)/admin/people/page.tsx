import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import PeopleAdmin from '@/app/ui/admin/people-admin'
import { PeopleSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('People')
  return { title: t('title') }
}

// Admins only (★): PeopleAdmin checks the role and answers 404 to anyone else.
export default function AdminPeoplePage({ searchParams }: PageProps<'/[locale]/admin/people'>) {
  return (
    <Suspense fallback={<PeopleSkeleton />}>
      <PeopleAdmin searchParams={searchParams} />
    </Suspense>
  )
}
