'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

type Props = {
  children: ReactNode
  /** Shown while the form is submitting, when the button is also disabled. */
  pendingLabel: string
  variant?: ButtonVariant
}

/** A form's submit button with its pending state; it must sit inside the `<form>`. */
export default function SubmitButton({ children, pendingLabel, variant = 'primary' }: Props) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className={buttonClassName(variant)}>
      {pending ? pendingLabel : children}
    </button>
  )
}
