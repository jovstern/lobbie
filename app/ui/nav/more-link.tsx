import { ChevronRightIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

type Props = { href: string; icon: ReactNode; children: ReactNode }

/** A row of the More menu that opens another page. */
export default function MoreLink({ href, icon, children }: Props) {
  return (
    <li className="py-1 first:pt-0 last:pb-0">
      <Link
        href={href}
        className="rounded-control hover:bg-surface active:bg-border relative flex min-h-12 items-center gap-3 px-3 font-medium transition-[background-color,border-color,color]"
      >
        <span aria-hidden className="text-text-muted size-6 shrink-0 *:size-6">
          {icon}
        </span>
        {children}
        <ChevronRightIcon aria-hidden className="text-text-muted ms-auto size-5 rtl:-scale-x-100" />
        {/* A tap on a page that was not prefetched shows at once. */}
        <LinkPending className="end-2 top-2" />
      </Link>
    </li>
  )
}
