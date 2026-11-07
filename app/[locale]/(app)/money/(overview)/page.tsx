import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import MoneyView from '@/app/ui/money/money-view'
import { ApartmentMoneySkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Money')
  return { title: t('title') }
}

// Every member (R16). The header is in the layout, in the static shell;
// MoneyView checks the membership before anything is read.
export default function MoneyPage({ searchParams }: PageProps<'/[locale]/money'>) {
  return (
    <Suspense fallback={<ApartmentMoneySkeleton />}>
      <MoneyView searchParams={searchParams} />
    </Suspense>
  )
}
