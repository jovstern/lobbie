import { getTranslations } from 'next-intl/server'
import type { ApartmentRef } from '@/app/lib/definitions'
import { Link } from '@/i18n/navigation'

/** A person's apartments, each a link to its admin page; or a note that they have none. */
export default async function ApartmentChips({ apartments }: { apartments: ApartmentRef[] }) {
  const t = await getTranslations('People')
  if (apartments.length === 0) {
    return <span className="text-text-muted">{t('noApartment')}</span>
  }

  return (
    <ul className="flex flex-wrap gap-x-1">
      {apartments.map((apartment) => (
        <li key={apartment.id}>
          {/* The link is the 44 px target; the chip is what shows. */}
          <Link
            href={`/admin/apartments/${apartment.id}`}
            aria-label={t('apartmentLabel', { number: apartment.number })}
            className="group inline-flex min-h-11 min-w-11 items-center justify-center"
          >
            <span className="border-border bg-surface group-hover:border-accent group-hover:text-accent rounded-full border px-2.5 py-0.5 text-sm font-medium tabular-nums transition-[border-color,color]">
              {apartment.number}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
