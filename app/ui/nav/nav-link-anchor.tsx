import clsx from 'clsx'
import type { ReactNode } from 'react'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

export type NavLinkProps = {
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

const variants = {
  // The ring sits inside the tab, so the screen's bottom edge cannot clip it.
  tab: 'min-h-11 w-full flex-col justify-center gap-0.5 rounded-control px-3 py-1 text-sm focus-visible:outline-offset-[-2px]',
  side: 'min-h-11 gap-3 rounded-control px-3 text-base',
}

/** A navigation item's link, current or not as it is told. */
export default function NavLinkAnchor({
  href,
  icon,
  activeIcon,
  variant = 'side',
  children,
  isCurrent,
}: Omit<NavLinkProps, 'sections'> & { isCurrent: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={clsx(
        'text-text-muted hover:bg-surface hover:text-text active:bg-border aria-[current=page]:text-accent relative flex items-center font-medium transition-[background-color,border-color,color]',
        variant === 'side' && 'aria-[current=page]:bg-surface',
        variants[variant],
      )}
    >
      <span aria-hidden className="size-6 shrink-0 *:size-6">
        {isCurrent ? activeIcon : icon}
      </span>
      {children}
      <LinkPending
        className={variant === 'tab' ? 'end-3 top-1.5' : 'end-3 top-1/2 -translate-y-1/2'}
      />
    </Link>
  )
}
