'use client'

import type { ReactNode } from 'react'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link, usePathname } from '@/i18n/navigation'

type Props = {
  href: string
  children: ReactNode
}

/** One admin section's link; the overview is current only on itself, the others below too. */
export default function AdminNavLink({ href, children }: Props) {
  const pathname = usePathname()
  const isCurrent = pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className="text-text-muted hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-accent relative -mb-px flex min-h-11 items-center border-b-2 border-transparent px-1 font-medium whitespace-nowrap transition-[border-color,color]"
    >
      {children}
      <LinkPending className="-end-1 top-2" />
    </Link>
  )
}
