import { getLocale, getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { balance } from '@/app/lib/data/ledger'
import { formatAgorot } from '@/app/lib/utils/money'
import Card, { homeCardHeights } from '@/app/ui/card'

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
    </Card>
  )
}
