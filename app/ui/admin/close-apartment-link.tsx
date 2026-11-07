'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { rememberClosed } from '@/app/ui/admin/closed-apartment'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

type Props = { href: string; apartmentId: string; label: string }

/**
 * The × that closes the apartment opened on `/admin/payments`. The link it was is gone once the
 * page has no apartment open, so focus would fall to the page: `ReturnFocus` hands it to the
 * closed apartment's link in the grid instead.
 */
export default function CloseApartmentLink({ href, apartmentId, label }: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={() => rememberClosed(apartmentId)}
      className="rounded-control text-text-muted hover:bg-surface hover:text-text relative -me-2 -mt-2 flex size-11 shrink-0 items-center justify-center transition-[background-color,color]"
    >
      <XMarkIcon aria-hidden className="size-6" />
      <LinkPending className="end-0 top-0" />
    </Link>
  )
}
