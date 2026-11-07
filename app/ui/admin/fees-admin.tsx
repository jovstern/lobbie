import { BanknotesIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import { followBuilding, setDefault, setOverride } from '@/app/lib/actions/fees'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/fees'
import { addMonths, formatMonth } from '@/app/lib/utils/dates'
import { followBuildingMonth } from '@/app/lib/utils/fees'
import { formatAgorot } from '@/app/lib/utils/money'
import { hasRole } from '@/app/lib/utils/roles'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import FeeDialog from '@/app/ui/admin/fee-dialog'
import FeeHistory from '@/app/ui/admin/fee-history'
import FollowBuildingDialog from '@/app/ui/admin/follow-building-dialog'
import { cardClassName } from '@/app/ui/card'
import { Link } from '@/i18n/navigation'

/** The page's heading, which takes focus when the button a dialog opened from is gone. */
const headingId = 'fees-title'

/** An empty list inside a card: what it means, and what to do. */
function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-control bg-surface flex flex-col items-start gap-2 p-4">
      <BanknotesIcon aria-hidden className="text-text-muted size-7" />
      <p className="font-semibold">{title}</p>
      <p className="text-text-muted">{body}</p>
    </div>
  )
}

/**
 * `/admin/fees` for the committee and up (R14): the building's monthly fee with its history,
 * and the apartments that pay a fee of their own. Each new fee starts from a month; the months
 * before it keep theirs.
 */
export default async function FeesAdmin() {
  // The committee and up; anyone else gets the 404, before anything of the building is read.
  const { role, timeZone } = await requireRole('committee')
  const [schedule, t, locale] = await Promise.all([
    list(),
    getTranslations('AdminFees'),
    getLocale(),
  ])
  const { currentMonth, billingStartMonth, building, apartments, choices } = schedule
  const current = building.find((period) => period.state === 'current')
  // Newest first, so the last upcoming one is the next to start.
  const next = building.findLast((period) => period.state === 'upcoming')
  // A new fee starts next month by default, never before billing does; the building's first
  // one starts with billing.
  const nextMonth = addMonths(currentMonth, 1)
  const changeMonth = billingStartMonth > nextMonth ? billingStartMonth : nextMonth
  // Once the building has a fee, months that have passed keep theirs (spec §3).
  const firstMonth = billingStartMonth > currentMonth ? billingStartMonth : currentMonth
  // The apartment pages are the admin's alone.
  const linkApartments = hasRole(role, 'admin')

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <AdminAnnouncer
      headingId={headingId}
      header={<AdminPageHeader title={t('title')} lead={t('lead')} headingId={headingId} />}
    >
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <section aria-labelledby="building-fee-title" className={cardClassName}>
          <h2 id="building-fee-title" className="text-lg font-semibold">
            {t('buildingTitle')}
          </h2>
          {current ? (
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-semibold tabular-nums">
                  {formatAgorot(current.amountAgorot, locale)}
                </span>
                <span className="text-text-muted">{t('perMonth')}</span>
              </p>
              <p className="text-text-muted">
                {t('since', { month: formatMonth(current.effectiveFrom, locale) })}
              </p>
            </div>
          ) : (
            <EmptyNote title={t('noFeeTitle')} body={t('noFeeBody')} />
          )}
          {next ? (
            <p className="font-medium">
              {t('nextChange', {
                month: formatMonth(next.effectiveFrom, locale),
                amount: formatAgorot(next.amountAgorot, locale),
              })}
            </p>
          ) : null}
          <FeeDialog
            action={setDefault.bind(null, locale)}
            target={{ kind: 'building' }}
            defaultMonth={building.length === 0 ? billingStartMonth : changeMonth}
            minMonth={building.length === 0 ? billingStartMonth : firstMonth}
            variant={building.length === 0 ? 'primary' : 'secondary'}
          />
          {/* A history of one fee would only repeat the fee above. */}
          {building.length > 1 ? (
            <section aria-labelledby="building-history-title" className="flex flex-col gap-3">
              <h3 id="building-history-title" className="text-base font-semibold">
                {t('historyTitle')}
              </h3>
              <FeeHistory periods={building} timeZone={timeZone} />
            </section>
          ) : null}
        </section>

        <section aria-labelledby="apartment-fees-title" className={cardClassName}>
          <div className="flex flex-col gap-1">
            <h2 id="apartment-fees-title" className="text-lg font-semibold">
              {t('apartmentsTitle')}
            </h2>
            <p className="text-text-muted text-pretty">{t('apartmentsLead')}</p>
          </div>
          {choices.length > 0 ? (
            <FeeDialog
              action={setOverride.bind(null, locale, null)}
              target={{ kind: 'chosen', choices }}
              defaultMonth={changeMonth}
            />
          ) : null}
          {choices.length === 0 ? (
            <EmptyNote title={t('noApartmentsTitle')} body={t('noApartmentsBody')} />
          ) : apartments.length === 0 ? (
            <EmptyNote title={t('noOverridesTitle')} body={t('noOverridesBody')} />
          ) : (
            <ul className="flex flex-col gap-6">
              {apartments.map(({ apartment, periods }) => {
                const titleId = `apartment-fee-${apartment.id}`
                const name = t('apartment', { number: apartment.number })
                const followFrom = followBuildingMonth(periods, currentMonth)
                return (
                  <li key={apartment.id}>
                    <section aria-labelledby={titleId} className="flex flex-col gap-3">
                      <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold">
                        <HomeModernIcon aria-hidden className="text-text-muted size-5" />
                        {linkApartments ? (
                          <Link
                            href={`/admin/apartments/${apartment.id}`}
                            className="text-accent underline-offset-4 hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </h3>
                      <FeeHistory periods={periods} timeZone={timeZone} />
                      {followFrom ? (
                        <div>
                          <FollowBuildingDialog
                            action={followBuilding.bind(null, locale, apartment.id, followFrom)}
                            number={apartment.number}
                            month={followFrom}
                          />
                        </div>
                      ) : null}
                    </section>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminAnnouncer>
  )
}
