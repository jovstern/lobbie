'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

type Props = {
  children: ReactNode
  /** Shown while the form is submitting, when the button is also disabled. */
  pendingLabel: string
  variant?: ButtonVariant
  /** Also disabled while another form's action on the same state is running. */
  disabled?: boolean
}

/** A form's submit button with its pending state; it must sit inside the `<form>`. */
export default function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  disabled = false,
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending || disabled} className={buttonClassName(variant)}>
      {pending ? pendingLabel : children}
    </button>
  )
}
