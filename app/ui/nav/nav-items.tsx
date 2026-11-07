import {
  BanknotesIcon as MoneyOutline,
  BuildingOffice2Icon as BuildingOutline,
  EllipsisHorizontalCircleIcon as MoreOutline,
  HomeIcon as HomeOutline,
} from '@heroicons/react/24/outline'
import {
  BanknotesIcon as MoneySolid,
  BuildingOffice2Icon as BuildingSolid,
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
  label: 'home' | 'money' | 'building' | 'more'
  /**
   * Read after the label by screen readers and search engines only, where the short label
   * alone would be too vague ("More" is one of Lighthouse's generic link texts).
   */
  hiddenLabel?: 'moreHidden'
  icon: ReactNode
  activeIcon: ReactNode
}

// Only pages that exist (spec §6, "Navigation"): Schedule joins between Money and Building
// when its milestone lands. Money is every member's, whatever their apartments (its page says
// when there is none). Profile is reached from More, so More stays current there; so is Admin
// on phones, while the side nav has an Admin item of its own.
export const navItems: NavItem[] = [
  { href: '/', sections: ['/'], label: 'home', icon: <HomeOutline />, activeIcon: <HomeSolid /> },
  {
    href: '/money',
    sections: ['/money'],
    label: 'money',
    icon: <MoneyOutline />,
    activeIcon: <MoneySolid />,
  },
  {
    href: '/building',
    sections: ['/building'],
    label: 'building',
    icon: <BuildingOutline />,
    activeIcon: <BuildingSolid />,
  },
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
