'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/navigation'

type Props = {
  href: string
  /** The paths this item stands for; a page under any of them makes it current. */
  sections?: string[]
  icon: ReactNode
  /** Shown instead of `icon` while the item is current. */
  activeIcon: ReactNode
  /** `tab`: icon above a short label (phone tab bar); `side`: a row (desktop side nav). */
  variant?: 'tab' | 'side'
  children: ReactNode
}

function isWithin(pathname: string, section: string): boolean {
  if (section === '/') return pathname === '/'
  return pathname === section || pathname.startsWith(`${section}/`)
}

const variants = {
  tab: 'min-h-11 w-full flex-col justify-center gap-0.5 rounded-control px-3 py-1 text-sm',
  side: 'min-h-11 gap-3 rounded-control px-3 text-base',
}

/** A navigation item that knows whether it is the current page (from the locale-free path). */
export default function NavLink({
  href,
  sections = [href],
  icon,
  activeIcon,
  variant = 'side',
  children,
}: Props) {
  const pathname = usePathname()
  const isCurrent = sections.some((section) => isWithin(pathname, section))

  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={clsx(
        'text-text-muted hover:bg-surface hover:text-text active:bg-border aria-[current=page]:text-accent flex items-center font-medium transition-[background-color,border-color,color]',
        variant === 'side' && 'aria-[current=page]:bg-surface',
        variants[variant],
      )}
    >
      <span aria-hidden className="size-6 shrink-0 *:size-6">
        {isCurrent ? activeIcon : icon}
      </span>
      {children}
    </Link>
  )
}
