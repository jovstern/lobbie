import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import MoneyHeader from '@/app/ui/money/money-header'
import MoneyView from '@/app/ui/money/money-view'
import { ApartmentMoneySkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Money')
  return { title: t('title') }
}

// Every member (R16). The header is the same for everyone, so it is in the static shell;
// MoneyView checks the membership before anything is read.
export default function MoneyPage({ searchParams }: PageProps<'/[locale]/money'>) {
  return (
    <div className="flex flex-col gap-6">
      <MoneyHeader current="apartment" />
      <Suspense fallback={<ApartmentMoneySkeleton />}>
        <MoneyView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
