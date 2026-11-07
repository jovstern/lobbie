import { HomeModernIcon } from '@heroicons/react/24/outline'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireMember } from '@/app/lib/authz'
import { chosenApartment } from '@/app/lib/utils/payments'
import EmptyState from '@/app/ui/empty-state'
import ApartmentMoney from '@/app/ui/money/apartment-money'
import ApartmentSwitcher from '@/app/ui/money/apartment-switcher'
import { ApartmentMoneySkeleton, ApartmentSwitcherSkeleton } from '@/app/ui/skeletons'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * The person's apartment on `/money`: the one `?apartment=` names, or their first. Someone in
 * several apartments chooses among them; an apartment that is not theirs is a 404.
 */
export default async function MoneyView({ searchParams }: Props) {
  // A member of a building; anyone else is sent to sign in or to join.
  const [{ apartmentIds }, { apartment }, t] = await Promise.all([
    requireMember(),
    searchParams,
    getTranslations('Money'),
  ])
  if (apartmentIds.length === 0) {
    return (
      <EmptyState icon={HomeModernIcon} title={t('noApartmentTitle')} body={t('noApartmentBody')} />
    )
  }
  const apartmentId = chosenApartment(apartment, apartmentIds)
  if (apartmentId === null) notFound()

  return (
    <>
      {apartmentIds.length > 1 ? (
        // Not keyed: it stays, with focus on the link chosen, while that apartment loads.
        <Suspense fallback={<ApartmentSwitcherSkeleton count={apartmentIds.length} />}>
          <ApartmentSwitcher selectedId={apartmentId} />
        </Suspense>
      ) : null}
      {/* Keyed by the apartment, so choosing another shows the skeleton while it loads. */}
      <Suspense key={apartmentId} fallback={<ApartmentMoneySkeleton />}>
        <ApartmentMoney apartmentId={apartmentId} />
      </Suspense>
    </>
  )
}
