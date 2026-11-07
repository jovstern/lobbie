import type { GridMonth } from '@/app/lib/definitions'

/**
 * How a month's status looks, on the committee's grid and on `/money`. Status is never colour
 * alone: each has a mark (`.status-mark[data-status]` in globals.css, drawn from Heroicons'
 * solid set) and a word (`label`, a key both places' messages have). Months that ask nothing
 * (upcoming, before billing, without a fee) stay muted, so what is owed stands out.
 */
export const monthStatusLooks = {
  paid: { label: 'paid', className: 'text-success' },
  due: { label: 'due', className: 'text-warning' },
  overdue: { label: 'overdue', className: 'text-danger' },
  upcoming: { label: 'upcoming', className: 'text-text-muted' },
  'not-billed': { label: 'notBilled', className: 'text-text-muted' },
  'no-fee': { label: 'noFee', className: 'text-text-muted' },
} as const satisfies Record<GridMonth['kind'], unknown>
