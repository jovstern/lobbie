import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BalanceCard from '@/app/ui/home/balance-card'
import JoinedWelcome from '@/app/ui/home/joined-welcome'
import StatusCardBoundary from '@/app/ui/home/status-card-boundary'
import { BalanceCardSkeleton, StatusCardSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home')
  return { title: t('title') }
}

// The five-second answer (spec §1): am I paid up, and how much does the building have. Each
// card reads the member itself and streams on its own; the rest of the page is static.
export default async function HomePage({ searchParams }: PageProps<'/[locale]'>) {
  const t = await getTranslations('Home')

  return (
    <>
      {/* The top bar names the building; the status card is what the eye should land on. */}
      <h1 className="sr-only">{t('title')}</h1>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Nothing until it knows: most visits have no welcome to show. */}
        <Suspense fallback={null}>
          <JoinedWelcome searchParams={searchParams} />
        </Suspense>
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
