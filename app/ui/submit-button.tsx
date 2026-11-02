'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type Props = {
  children: ReactNode
  /** Shown while the form is submitting, when the button is also disabled. */
  pendingLabel: string
  variant?: 'primary' | 'secondary'
}

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-base font-medium transition-colors disabled:cursor-wait disabled:opacity-70'

const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90 active:bg-accent/80',
  secondary:
    'border border-text-muted bg-surface-raised text-text hover:bg-surface active:bg-border',
}

/** A form's submit button with its pending state; it must sit inside the `<form>`. */
export default function SubmitButton({ children, pendingLabel, variant = 'primary' }: Props) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className={clsx(base, variants[variant])}>
      {pending ? pendingLabel : children}
    </button>
  )
}
