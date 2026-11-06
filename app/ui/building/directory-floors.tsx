import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import type { DirectoryFloor } from '@/app/lib/definitions'
import ContactLinks from '@/app/ui/building/contact-links'

type Props = {
  floors: DirectoryFloor[]
  /** The signed-in member's apartments, which are marked. */
  myApartmentIds: string[]
}

/** The directory: a heading per floor, then a card per apartment with its residents. */
export default function DirectoryFloors({ floors, myApartmentIds }: Props) {
  const t = useTranslations('Directory')

  return (
    <div className="flex flex-col gap-8">
      {floors.map(({ floor, apartments }) => (
        <section key={floor} aria-labelledby={`floor-${floor}`} className="flex flex-col gap-3">
          <h2 id={`floor-${floor}`} className="text-lg font-semibold">
            {t('floor', { floor })}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {apartments.map((apartment) => {
              const isMine = myApartmentIds.includes(apartment.id)
              return (
                <li
                  key={apartment.id}
                  className={clsx(
                    'rounded-card bg-surface-raised shadow-card flex flex-col gap-3 border p-4',
                    isMine ? 'border-accent' : 'border-border',
                  )}
                >
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                    {t('apartment', { number: apartment.number })}
                    {isMine ? (
                      <>
                        {/* Read as "Apartment 3, Your apartment"; the chip shows it. */}
                        <span className="sr-only">,</span>{' '}
                        <span className="bg-surface border-border text-text-muted rounded-full border px-2 text-xs font-medium">
                          {t('yourApartment')}
                        </span>
                      </>
                    ) : null}
                  </h3>
                  {apartment.residents.length === 0 ? (
                    <p className="text-text-muted">{t('notJoined')}</p>
                  ) : (
                    <ul className="divide-border flex flex-col divide-y">
                      {apartment.residents.map((resident) => (
                        <li
                          key={resident.userId}
                          className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0"
                        >
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium wrap-anywhere">
                              {/* Someone without a name: their email when they share it,
                                  never one they keep hidden. */}
                              {resident.name ??
                                (resident.email ? (
                                  <bdi dir="ltr">{resident.email}</bdi>
                                ) : (
                                  t('unnamed')
                                ))}
                            </span>
                            <span className="text-text-muted text-sm">
                              {resident.isOwner ? t('owner') : t('tenant')}
                            </span>
                          </p>
                          <ContactLinks phone={resident.phone} email={resident.email} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
