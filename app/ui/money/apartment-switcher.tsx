import { getTranslations } from 'next-intl/server'
import { mine } from '@/app/lib/data/apartments'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

/** For someone who lives in several apartments: which one `/money` shows (`?apartment=`). */
export default async function ApartmentSwitcher({ selectedId }: { selectedId: string }) {
  const [apartments, t] = await Promise.all([mine(), getTranslations('Money')])

  return (
    <nav aria-label={t('apartmentsLabel')}>
      <ul className="flex flex-wrap gap-2">
        {apartments.map(({ id, number }) => (
          <li key={id}>
            <Link
              href={`/money?${new URLSearchParams({ apartment: id })}`}
              aria-current={id === selectedId ? 'page' : undefined}
              className="rounded-chip border-border bg-surface-raised hover:border-text-muted active:bg-surface aria-[current=page]:border-accent aria-[current=page]:bg-accent aria-[current=page]:text-on-accent relative inline-flex min-h-11 items-center border px-4 font-medium transition-[background-color,border-color,color]"
            >
              {t('apartment', { number })}
              <LinkPending className="end-2 top-2" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
