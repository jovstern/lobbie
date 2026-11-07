import { ChevronRightIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

/** A Home card's way to the page with the rest: below its figures, at the card's end. */
export default function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-accent relative mt-auto inline-flex min-h-11 w-fit items-center gap-1 font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ChevronRightIcon aria-hidden className="size-5 rtl:-scale-x-100" />
      <LinkPending className="-end-3 top-2" />
    </Link>
  )
}
