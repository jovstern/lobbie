import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BalanceView from '@/app/ui/money/balance-view'
import MoneyHeader from '@/app/ui/money/money-header'
import { BalanceSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Balance')
  return { title: t('title') }
}

// Every member (R19). The header is the same for everyone, so it is in the static shell;
// BalanceView checks the membership before anything is read.
export default function BalancePage({ searchParams }: PageProps<'/[locale]/money/balance'>) {
  return (
    <div className="flex flex-col gap-6">
      <MoneyHeader current="fund" />
      <Suspense fallback={<BalanceSkeleton />}>
        <BalanceView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
