import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BalanceView from '@/app/ui/money/balance-view'
import { BalanceSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Balance')
  return { title: t('title') }
}

// Every member (R19). The header is in the layout, in the static shell;
// BalanceView checks the membership before anything is read.
export default function BalancePage({ searchParams }: PageProps<'/[locale]/money/balance'>) {
  return (
    <Suspense fallback={<BalanceSkeleton />}>
      <BalanceView searchParams={searchParams} />
    </Suspense>
  )
}
