import { getLocale, getTranslations } from 'next-intl/server'
import { addAdjustment, update } from '@/app/lib/actions/buildings'
import { requireRole } from '@/app/lib/authz'
import { adjustments, get } from '@/app/lib/data/buildings'
import { formatAgorot } from '@/app/lib/utils/money'
import AdjustmentDialog from '@/app/ui/admin/adjustment-dialog'
import AdjustmentList from '@/app/ui/admin/adjustment-list'
import BuildingForm from '@/app/ui/admin/building-form'
import Card from '@/app/ui/card'
import { moneyFont } from '@/app/ui/money-font'

/** `/admin/building` for an admin: the details form beside the fund and its corrections. */
export default async function BuildingSettings() {
  // Admins only; anyone else gets the 404, before anything of the building is read.
  const { timeZone } = await requireRole('admin')
  const [details, rows, t, locale] = await Promise.all([
    get(),
    adjustments(),
    getTranslations('AdminBuilding'),
    getLocale(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Card titleId="building-details-title" title={t('detailsTitle')}>
          <BuildingForm
            action={update.bind(null, locale, false)}
            confirmedAction={update.bind(null, locale, true)}
            saved={{
              name: details.name,
              address: details.address,
              quorumPercent: String(details.quorumPercent),
              billingStartMonth: details.billingStartMonth,
            }}
          />
        </Card>
        {/* Amounts: the font instance that preloads ₪'s file. */}
        <div className={moneyFont.className}>
          <Card titleId="building-fund-title" title={t('fundTitle')}>
            <dl className="flex flex-col gap-1">
              <dt className="text-sm font-medium">{t('openingBalance')}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatAgorot(details.openingBalanceAgorot, locale)}
              </dd>
              <dd className="text-text-muted text-sm">{t('openingBalanceHint')}</dd>
            </dl>
            <section aria-labelledby="adjustments-title" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="adjustments-title" className="text-lg font-semibold">
                  {t('adjustmentsTitle')}
                </h3>
                <AdjustmentDialog action={addAdjustment.bind(null, locale)} />
              </div>
              <AdjustmentList adjustments={rows} timeZone={timeZone} />
            </section>
          </Card>
        </div>
      </div>
    </div>
  )
}
