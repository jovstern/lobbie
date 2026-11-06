import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BuildingPageHeader from '@/app/ui/building/building-page-header'
import DirectoryView from '@/app/ui/building/directory-view'
import { DirectorySkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Directory')
  return { title: t('title') }
}

// Every member (R11); DirectoryView checks the membership before anything is read.
export default async function DirectoryPage({
  searchParams,
}: PageProps<'/[locale]/building/directory'>) {
  const t = await getTranslations('Directory')

  return (
    <div className="flex flex-col gap-6">
      <BuildingPageHeader title={t('title')} lead={t('lead')} />
      <Suspense fallback={<DirectorySkeleton />}>
        <DirectoryView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
