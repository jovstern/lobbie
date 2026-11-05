import { getLocale, getTranslations } from 'next-intl/server'
import { remove, update } from '@/app/lib/actions/apartments'
import type { ApartmentListItem } from '@/app/lib/definitions'
import { blockersOf, describeBlockers } from '@/app/lib/utils/apartment-blockers'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import RemoveApartmentDialog from '@/app/ui/admin/remove-apartment-dialog'

type Props = {
  apartment: ApartmentListItem
  /** Which of the page's two layouts this is in, so the ids stay unique. */
  layout: 'table' | 'cards'
}

/** A row's "Edit" and "Remove", the second with the reason it is blocked, if it is. */
export default async function ApartmentRowActions({ apartment, layout }: Props) {
  const [locale, tBlockers] = await Promise.all([getLocale(), getTranslations('ApartmentBlockers')])
  const blockers = blockersOf(apartment)

  return (
    <div className="flex flex-wrap items-start gap-2">
      <ApartmentDialog
        action={update.bind(null, locale, apartment.id, false)}
        confirmedAction={update.bind(null, locale, apartment.id, true)}
        saved={{
          number: apartment.number,
          floor: String(apartment.floor),
          billingStartMonth: apartment.billingStartMonth ?? '',
        }}
      />
      <RemoveApartmentDialog
        action={remove.bind(null, locale, apartment.id)}
        number={apartment.number}
        blockedReason={blockers.length > 0 ? describeBlockers(tBlockers, blockers) : null}
        reasonId={`remove-reason-${layout}-${apartment.id}`}
      />
    </div>
  )
}
