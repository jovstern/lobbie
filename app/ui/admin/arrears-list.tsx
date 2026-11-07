import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import type { Arrears } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'
import { overdueText } from '@/app/ui/home/overdue-text'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

type Props = {
  arrears: Arrears
  /** Where an apartment's link goes: the payments page with that apartment open. */
  hrefFor: (apartmentId: string) => string
}

/**
 * Who is behind and by how much (R17), the largest debt first, each apartment a link to its
 * payments; or, when nobody is, a line that says so. On `/admin` and `/admin/payments`.
 */
export default async function ArrearsList({ arrears, hrefFor }: Props) {
  const [t, tStatus, locale] = await Promise.all([
    getTranslations('AdminPayments'),
    getTranslations('StatusCard'),
    getLocale(),
  ])
  const { apartments, totalOwedAgorot } = arrears

  return (
    <section aria-labelledby="arrears-title" className={cardClassName}>
      <h2 id="arrears-title" className="text-lg font-semibold">
        {t('arrearsTitle')}
      </h2>
      {apartments.length === 0 ? (
        <div className="flex items-start gap-3">
          <CheckCircleIcon aria-hidden className="text-success size-7 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t('upToDateTitle')}</p>
            <p className="text-text-muted">{t('upToDateBody')}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-lg tabular-nums">
            {t('arrearsSummary', {
              count: apartments.length,
              amount: formatAgorot(totalOwedAgorot, locale),
            })}
          </p>
          <ul className="divide-border flex flex-col divide-y">
            {apartments.map((apartment) => (
              <li
                key={apartment.id}
                className="flex flex-wrap items-center justify-between gap-x-4 py-1 first:pt-0 last:pb-0"
              >
                <Link
                  href={hrefFor(apartment.id)}
                  data-select-apartment
                  className="text-accent relative inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
                >
                  {t('apartment', { number: apartment.number })}
                  <LinkPending className="-end-2 top-2" />
                </Link>
                <span className="text-danger tabular-nums">
                  {overdueText(apartment, tStatus, locale)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
