import { getLocale, getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { balance } from '@/app/lib/data/ledger'
import { formatAgorot } from '@/app/lib/utils/money'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import Card, { homeCardHeights } from '@/app/ui/card'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

/** The building fund of the member's own building. */
export default async function BalanceCard() {
  const { buildingId } = await requireMember()
  const [{ totalAgorot }, t, locale] = await Promise.all([
    balance(buildingId),
    getTranslations('BalanceCard'),
    getLocale(),
  ])

  return (
    <Card titleId="balance-card-title" title={t('title')} minHeight={homeCardHeights.balance}>
      <div className="flex flex-col gap-1">
        {/* Below the status card's sentence and figure: the status stays the focal point. */}
        <p className="text-xl font-semibold tabular-nums">{formatAgorot(totalAgorot, locale)}</p>
        <p className="text-text-muted">{t('asOf')}</p>
      </div>
      <Link
        href="/money/balance"
        className="text-accent relative inline-flex min-h-11 w-fit items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        {t('details')}
        <ChevronRightIcon aria-hidden className="size-5 rtl:-scale-x-100" />
        <LinkPending className="-end-3 top-2" />
      </Link>
    </Card>
  )
}
