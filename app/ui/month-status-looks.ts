import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
} from '@heroicons/react/20/solid'
import type { GridMonth } from '@/app/lib/definitions'

/**
 * How a month's status looks, on the committee's grid and on `/money`. Status is never colour
 * alone: each has an icon and a word (`label`, a key both places' messages have). Months that
 * ask nothing (ahead, before billing, without a fee) stay muted, so what is owed stands out.
 */
export const monthStatusLooks = {
  paid: { icon: CheckCircleIcon, label: 'paid', className: 'text-success' },
  due: { icon: ClockIcon, label: 'due', className: 'text-warning' },
  overdue: { icon: ExclamationTriangleIcon, label: 'overdue', className: 'text-danger' },
  upcoming: { icon: EllipsisHorizontalCircleIcon, label: 'upcoming', className: 'text-text-muted' },
  'not-billed': { icon: CalendarIcon, label: 'notBilled', className: 'text-text-muted' },
  'no-fee': { icon: MinusCircleIcon, label: 'noFee', className: 'text-text-muted' },
} as const satisfies Record<GridMonth['kind'], unknown>
