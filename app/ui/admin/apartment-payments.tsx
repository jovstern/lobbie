import { ChevronDownIcon, NoSymbolIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { record, voidPayment } from '@/app/lib/actions/payments'
import { requireRole } from '@/app/lib/authz'
import { forApartment } from '@/app/lib/data/payments'
import type { ApartmentStanding, PaymentEntry } from '@/app/lib/definitions'
import { formatDate, formatDay, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import PaymentDialog from '@/app/ui/admin/payment-dialog'
import VoidPaymentDialog from '@/app/ui/admin/void-payment-dialog'
import StatusChip from '@/app/ui/home/status-chip'
import { overdueText } from '@/app/ui/home/overdue-text'

/** The history's heading: focus goes to it once a voided payment's button is gone. */
const historyId = 'apartment-payments-history'
/** How many payments show before "Show all". */
const shown = 5

/**
 * The apartment's payments (R15), inside its admin page's Payments card or the apartment opened
 * on `/admin/payments`: how it stands, the button that records a payment, and its latest
 * payments, each one that counts with its Void. A voided payment stays listed, struck through,
 * with who voided it and why.
 */
export default async function ApartmentPayments({ apartmentId }: { apartmentId: Promise<string> }) {
  const id = await apartmentId
  const [{ timeZone }, payments, t, tStatus, tMethods, locale] = await Promise.all([
    // The committee's, as the payments are: the apartment's admin page and `/admin/payments`
    // each check their own role too.
    requireRole('committee'),
    forApartment(id),
    getTranslations('ApartmentPayments'),
    getTranslations('StatusCard'),
    getTranslations('PaymentMethods'),
    getLocale(),
  ])
  if (!payments) notFound()

  const monthName = formatMonth(payments.currentMonth, locale)
  function standingDetail(standing: ApartmentStanding): string | null {
    switch (standing.kind) {
      case 'paid':
        return t('paidUp', { month: monthName })
      case 'due':
        return tStatus('rowDue', { amount: formatAgorot(standing.remainingAgorot, locale) })
      case 'overdue':
        return overdueText(standing, tStatus, locale)
      // The chip says it all.
      case 'no-fee':
      case 'not-billed':
        return null
    }
  }
  const detail = standingDetail(payments.standing)

  function row(payment: PaymentEntry) {
    return (
      <li key={payment.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
        {/* Month and amount, then Void (or the voided mark) at the end, aligned row to row. */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={clsx('font-medium', payment.voided && 'text-text-muted')}>
              {formatMonth(payment.month, locale)}
            </span>
            <span
              className={clsx(
                'font-semibold tabular-nums',
                payment.voided && 'text-text-muted line-through',
              )}
            >
              {formatAgorot(payment.amountAgorot, locale)}
            </span>
          </p>
          {payment.voided ? (
            // Never colour alone: the mark has a word and an icon.
            <span className="rounded-chip border-border text-text-muted inline-flex items-center gap-1 border px-2.5 py-0.5 text-sm font-medium">
              <NoSymbolIcon aria-hidden className="size-4" />
              {t('voided')}
            </span>
          ) : (
            <VoidPaymentDialog
              action={voidPayment.bind(null, locale, payment.id)}
              month={payment.month}
              amountAgorot={payment.amountAgorot}
            />
          )}
        </div>
        <p className="text-text-muted text-sm">
          {t('paidOn', {
            date: formatDay(payment.paidOn, locale),
            method: tMethods(payment.method),
            name: payment.recordedByName,
          })}
        </p>
        {payment.note ? (
          <p className="text-text-muted text-sm break-words">{t('note', { note: payment.note })}</p>
        ) : null}
        {payment.voided ? (
          <p className="text-text-muted text-sm break-words">
            {t('voidedBy', {
              name: payment.voided.byName,
              date: formatDate(payment.voided.at, timeZone, locale),
              reason: payment.voided.reason,
            })}
          </p>
        ) : null}
      </li>
    )
  }

  const latest = payments.history.slice(0, shown)
  const earlier = payments.history.slice(shown)

  // Its own status region and heading: what was recorded or voided is said here, by the
  // buttons that did it, not at the top of the page.
  return (
    <AdminAnnouncer
      headingId={historyId}
      header={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <StatusChip kind={payments.standing.kind} />
            {detail ? <p className="tabular-nums">{detail}</p> : null}
          </div>
          <PaymentDialog
            action={record.bind(null, locale, id)}
            number={payments.number}
            months={payments.openMonths}
            today={payments.today}
            firstDay={payments.firstDay}
            lastMonth={payments.lastMonth}
          />
        </div>
      }
    >
      <section aria-labelledby={historyId} className="flex flex-col gap-3">
        <h3 id={historyId} tabIndex={-1} className="text-base font-semibold">
          {t('historyTitle')}
        </h3>
        {payments.history.length > 0 ? (
          <>
            <ol className="divide-border flex flex-col divide-y">{latest.map(row)}</ol>
            {earlier.length > 0 ? (
              // The rest on request, so a long history does not push the grid down.
              <details className="group flex flex-col">
                <summary className="text-accent rounded-control inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium underline-offset-4 hover:underline">
                  <ChevronDownIcon
                    aria-hidden
                    className="size-5 transition-transform group-open:rotate-180"
                  />
                  {t('showAll', { count: payments.history.length })}
                </summary>
                <ol className="divide-border border-border flex flex-col divide-y border-t pt-3">
                  {earlier.map(row)}
                </ol>
              </details>
            ) : null}
          </>
        ) : (
          <p className="text-text-muted">{t('empty')}</p>
        )}
        {payments.historyLimited ? (
          <p className="text-text-muted text-sm">
            {t('limited', { count: payments.history.length })}
          </p>
        ) : null}
      </section>
    </AdminAnnouncer>
  )
}
