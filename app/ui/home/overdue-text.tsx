import type { ReactNode } from 'react'
import type { ApartmentStanding } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import type { Locale } from '@/i18n/routing'

type Overdue = Extract<ApartmentStanding, { kind: 'overdue' }>

type Part = (chunks: ReactNode) => ReactNode

/** The `StatusCard` keys it needs, from either the server's or the client's translator. */
type Translate = {
  rich(
    key: 'rowOverdue' | 'rowOverdueAndDue',
    values: { overdue: string; count: number; due?: string; part: Part },
  ): ReactNode
}

/** Each part of the sentence stays on one line; a narrow screen breaks between them. */
const part: Part = (chunks) => <span className="whitespace-nowrap">{chunks}</span>

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
): ReactNode {
  const overdue = formatAgorot(overdueAgorot, locale)
  const dueAgorot = totalOwedAgorot - overdueAgorot
  if (dueAgorot === 0) return t.rich('rowOverdue', { overdue, count: monthsBehind, part })
  return t.rich('rowOverdueAndDue', {
    overdue,
    count: monthsBehind,
    due: formatAgorot(dueAgorot, locale),
    part,
  })
}
