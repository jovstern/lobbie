import {
  EllipsisHorizontalCircleIcon as MoreOutline,
  HomeIcon as HomeOutline,
} from '@heroicons/react/24/outline'
import {
  EllipsisHorizontalCircleIcon as MoreSolid,
  HomeIcon as HomeSolid,
} from '@heroicons/react/24/solid'
import type { ReactNode } from 'react'

type NavItem = {
  href: string
  /** The paths that make this item current. */
  sections: string[]
  /** On the tab bar, if more: pages reached from this tab, which the side nav lists itself. */
  tabSections?: string[]
  label: 'home' | 'more'
  /**
   * Read after the label by screen readers and search engines only, where the short label
   * alone would be too vague ("More" is one of Lighthouse's generic link texts).
   */
  hiddenLabel?: 'moreHidden'
  icon: ReactNode
  activeIcon: ReactNode
}

// Only pages that exist (spec §6, "Navigation"): Money, Schedule and Building join as their
// milestones land. Profile is reached from More, so More stays current there; so is Admin on
// phones, while the side nav has an Admin item of its own.
export const navItems: NavItem[] = [
  { href: '/', sections: ['/'], label: 'home', icon: <HomeOutline />, activeIcon: <HomeSolid /> },
  {
    href: '/more',
    sections: ['/more', '/profile'],
    tabSections: ['/more', '/profile', '/admin'],
    label: 'more',
    hiddenLabel: 'moreHidden',
    icon: <MoreOutline />,
    activeIcon: <MoreSolid />,
  },
]
