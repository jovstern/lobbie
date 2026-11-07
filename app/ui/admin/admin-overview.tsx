import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ChevronRightIcon,
  HomeModernIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import { getTranslations } from 'next-intl/server'
import type { ComponentType, SVGProps } from 'react'
import { requireRole } from '@/app/lib/authz'
import type { Role } from '@/app/lib/definitions'
import { hasRole } from '@/app/lib/utils/roles'
import { cardClassName } from '@/app/ui/card'
import { Link } from '@/i18n/navigation'

type OverviewLink = {
  href: string
  id: string
  label: 'buildingLink' | 'apartmentsLink' | 'peopleLink' | 'feesLink'
  body: 'buildingLinkBody' | 'apartmentsLinkBody' | 'peopleLinkBody' | 'feesLinkBody'
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** The lowest role that may open it, as in `adminSections`. */
  minRole: Role
}

// Every role that reaches the overview (the committee and up) has at least the fees.
const overviewLinks: OverviewLink[] = [
  {
    href: '/admin/building',
    id: 'admin-building-link',
    label: 'buildingLink',
    body: 'buildingLinkBody',
    minRole: 'admin',
    icon: BuildingOffice2Icon,
  },
  {
    href: '/admin/apartments',
    id: 'admin-apartments-link',
    label: 'apartmentsLink',
    body: 'apartmentsLinkBody',
    minRole: 'admin',
    icon: HomeModernIcon,
  },
  {
    href: '/admin/people',
    id: 'admin-people-link',
    label: 'peopleLink',
    body: 'peopleLinkBody',
    minRole: 'admin',
    icon: UsersIcon,
  },
  {
    href: '/admin/fees',
    id: 'admin-fees-link',
    label: 'feesLink',
    body: 'feesLinkBody',
    minRole: 'committee',
    icon: BanknotesIcon,
  },
]

/** `/admin` for the committee and up: a link to each admin page the member may open. */
export default async function AdminOverview() {
  // Committee and up; a resident gets the 404.
  const { role } = await requireRole('committee')
  const t = await getTranslations('Admin')
  const links = overviewLinks.filter((link) => hasRole(role, link.minRole))

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} lead={t('lead')} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, id, label, body, icon: Icon }) => (
          // The link holds only the title, so its name is its visible text; its ::after
          // covers the card, so the whole card is the target, and the card shows the focus.
          <li
            key={href}
            className={`${cardClassName} hover:border-text-muted has-active:bg-surface has-focus-visible:outline-accent relative h-full transition-[background-color,border-color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2`}
          >
            <span className="flex items-center gap-3">
              <Icon aria-hidden className="text-accent size-6 shrink-0" />
              <Link
                href={href}
                aria-describedby={`${id}-body`}
                className="after:rounded-card text-lg font-semibold outline-none after:absolute after:inset-0"
              >
                {t(label)}
              </Link>
              <ChevronRightIcon
                aria-hidden
                className="text-text-muted ms-auto size-5 shrink-0 rtl:-scale-x-100"
              />
            </span>
            <span id={`${id}-body`} className="text-text-muted">
              {t(body)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
