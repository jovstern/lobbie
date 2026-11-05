import clsx from 'clsx'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BalanceCard from '@/app/ui/home/balance-card'
import StatusCardBoundary from '@/app/ui/home/status-card-boundary'
import { moneyFont } from '@/app/ui/money-font'
import { BalanceCardSkeleton, StatusCardSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home')
  return { title: t('title') }
}

// The five-second answer (spec §1): am I paid up, and how much does the building have. Each
// card reads the member itself and streams on its own; the rest of the page is static.
export default async function HomePage() {
  const t = await getTranslations('Home')

  return (
    <>
      {/* The top bar names the building; the status card is what the eye should land on. */}
      <h1 className="sr-only">{t('title')}</h1>
      {/* Both cards show amounts: the font instance that preloads ₪'s file. */}
      <div className={clsx('grid gap-4 lg:grid-cols-2 lg:gap-6', moneyFont.className)}>
        <Suspense fallback={<StatusCardSkeleton />}>
          <StatusCardBoundary />
        </Suspense>
        <Suspense fallback={<BalanceCardSkeleton />}>
          <BalanceCard />
        </Suspense>
      </div>
    </>
  )
}
