'use client'

import NavLinkAnchor, { type NavLinkProps } from '@/app/ui/nav/nav-link-anchor'
import { usePathname } from '@/i18n/navigation'

function isWithin(pathname: string, section: string): boolean {
  if (section === '/') return pathname === '/'
  return pathname === section || pathname.startsWith(`${section}/`)
}

/** A navigation item that knows whether it is the current page (from the locale-free path). */
export default function CurrentNavLink({ sections, ...props }: NavLinkProps) {
  const pathname = usePathname()
  const isCurrent = (sections ?? [props.href]).some((section) => isWithin(pathname, section))

  return <NavLinkAnchor {...props} isCurrent={isCurrent} />
}
