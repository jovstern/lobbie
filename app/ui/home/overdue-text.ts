import type { ApartmentStanding } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Locale } from '@/i18n/routing'

type Overdue = Extract<ApartmentStanding, { kind: 'overdue' }>

/** The `StatusCard` keys it needs, from either the server's or the client's translator. */
type Translate = (
  key: 'rowOverdue' | 'rowOverdueAndDue',
  values: { overdue: string; count: number; due: string },
) => string

/**
 * What an apartment behind owes, in words: the overdue months' amount with their count, then
 * what is due this month on its own, so the count never reads as the whole amount.
 */
export function overdueText(
  {
    overdueAgorot,
    totalOwedAgorot,
    monthsBehind,
  }: Pick<Overdue, 'overdueAgorot' | 'totalOwedAgorot' | 'monthsBehind'>,
  t: Translate,
  locale: Locale,
): string {
  const dueAgorot = totalOwedAgorot - overdueAgorot
  return t(dueAgorot > 0 ? 'rowOverdueAndDue' : 'rowOverdue', {
    overdue: formatAgorot(overdueAgorot, locale),
    count: monthsBehind,
    due: formatAgorot(dueAgorot, locale),
  })
}
