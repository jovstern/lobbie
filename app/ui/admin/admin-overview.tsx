import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ChevronRightIcon,
  CreditCardIcon,
  HomeModernIcon,
  ReceiptPercentIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ComponentType, type SVGProps } from 'react'
import { requireRole } from '@/app/lib/authz'
import { arrears } from '@/app/lib/data/payments'
import type { Role } from '@/app/lib/definitions'
import { hasRole } from '@/app/lib/utils/roles'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import ArrearsBoundary from '@/app/ui/admin/arrears-boundary'
import ArrearsList from '@/app/ui/admin/arrears-list'
import { buttonClassName } from '@/app/ui/button-styles'
import { cardClassName } from '@/app/ui/card'
import { moneyFont } from '@/app/ui/money-font'
import { ArrearsSkeleton } from '@/app/ui/skeletons'
import { Link } from '@/i18n/navigation'

type OverviewLink = {
  href: string
  id: string
  label:
    'paymentsLink' | 'expensesLink' | 'buildingLink' | 'apartmentsLink' | 'peopleLink' | 'feesLink'
  body:
    | 'paymentsLinkBody'
    | 'expensesLinkBody'
    | 'buildingLinkBody'
    | 'apartmentsLinkBody'
    | 'peopleLinkBody'
    | 'feesLinkBody'
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** The lowest role that may open it, as in `adminSections`. */
  minRole: Role
}

// Every role that reaches the overview (the committee and up) has at least payments, expenses
// and fees.
const overviewLinks: OverviewLink[] = [
  {
    href: '/admin/payments',
    id: 'admin-payments-link',
    label: 'paymentsLink',
    body: 'paymentsLinkBody',
    minRole: 'committee',
    icon: CreditCardIcon,
  },
  {
    href: '/admin/expenses',
    id: 'admin-expenses-link',
    label: 'expensesLink',
    body: 'expensesLinkBody',
    minRole: 'committee',
    icon: ReceiptPercentIcon,
  },
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

/** An apartment's payments, opened on the payments page. */
const paymentsOf = (apartmentId: string) =>
  `/admin/payments?${new URLSearchParams({ apartment: apartmentId })}`

/** Who is behind, read on its own so the rest of the overview does not wait for it. */
async function OverviewArrears() {
  return <ArrearsList arrears={await arrears()} hrefFor={paymentsOf} />
}

/**
 * `/admin` for the committee and up (R17): who is behind and by how much, the way to record a
 * payment, and a link to each admin page the member may open.
 */
export default async function AdminOverview() {
  // Committee and up; a resident gets the 404.
  const { role } = await requireRole('committee')
  const [t, tPayments] = await Promise.all([
    getTranslations('Admin'),
    getTranslations('AdminPayments'),
  ])
  const links = overviewLinks.filter((link) => hasRole(role, link.minRole))

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-4">
        <AdminPageHeader title={t('title')} lead={t('lead')} />
        {/* Recording starts from the grid, where the apartment is chosen. */}
        <Link href="/admin/payments" className={buttonClassName('primary')}>
          <BanknotesIcon aria-hidden className="size-5" />
          {t('recordPayment')}
        </Link>
      </div>
      {/* Amounts: the font instance that preloads ₪'s file. */}
      <div className={`${moneyFont.className} max-w-2xl`}>
        <ArrearsBoundary title={tPayments('arrearsTitle')} message={tPayments('arrearsFailed')}>
          <Suspense fallback={<ArrearsSkeleton />}>
            <OverviewArrears />
          </Suspense>
        </ArrearsBoundary>
      </div>
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
