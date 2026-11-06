import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BuildingPageHeader from '@/app/ui/building/building-page-header'
import CommitteeList from '@/app/ui/building/committee-list'
import { CommitteeSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Committee')
  return { title: t('title') }
}

// Every member (R12); the committee read checks the membership itself.
export default async function CommitteePage() {
  const t = await getTranslations('Committee')

  return (
    <div className="flex flex-col gap-6">
      <BuildingPageHeader title={t('title')} lead={t('lead')} />
      <Suspense fallback={<CommitteeSkeleton />}>
        <CommitteeList />
      </Suspense>
    </div>
  )
}
