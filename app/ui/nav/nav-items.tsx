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
  label: 'home' | 'more'
  icon: ReactNode
  activeIcon: ReactNode
}

// Only pages that exist (spec §6, "Navigation"): Money, Schedule and Building join as their
// milestones land. Profile is reached from More, so More stays current there.
export const navItems: NavItem[] = [
  { href: '/', sections: ['/'], label: 'home', icon: <HomeOutline />, activeIcon: <HomeSolid /> },
  {
    href: '/more',
    sections: ['/more', '/profile'],
    label: 'more',
    icon: <MoreOutline />,
    activeIcon: <MoreSolid />,
  },
]
