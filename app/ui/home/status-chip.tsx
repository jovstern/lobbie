import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import type { ApartmentStanding } from '@/app/lib/definitions'

type Kind = ApartmentStanding['kind']

// Status is never colour alone: each chip has a word and an icon.
const chips = {
  paid: { icon: CheckCircleIcon, label: 'paid', className: 'text-success border-success' },
  due: { icon: ClockIcon, label: 'due', className: 'text-warning border-warning-fill' },
  overdue: {
    icon: ExclamationTriangleIcon,
    label: 'overdue',
    className: 'text-danger border-danger',
  },
  'no-fee': { icon: MinusCircleIcon, label: 'noFee', className: 'text-text-muted border-border' },
  'not-billed': {
    icon: CalendarIcon,
    label: 'notBilled',
    className: 'text-text-muted border-border',
  },
} as const satisfies Record<Kind, unknown>

export default function StatusChip({ kind }: { kind: Kind }) {
  const t = useTranslations('StatusCard')
  const { icon: Icon, label, className } = chips[kind]

  return (
    <span
      className={clsx(
        'rounded-chip inline-flex w-fit shrink-0 items-center gap-1.5 border px-3 py-1 text-sm font-medium',
        className,
      )}
    >
      <Icon aria-hidden className="size-4" />
      {t(label)}
    </span>
  )
}
