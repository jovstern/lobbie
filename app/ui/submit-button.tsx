'use client'

import clsx from 'clsx'
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
  /** Layout only, such as full width on phones. */
  className?: string
}

/**
 * A form's submit button with its pending state; it must sit inside the `<form>`. While
 * pending it is `aria-disabled` and ignores activation, rather than `disabled`: a disabled
 * button drops the focus to the page.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  disabled = false,
  className,
}: Props) {
  const { pending } = useFormStatus()
  const inactive = pending || disabled

  return (
    <button
      type="submit"
      aria-disabled={inactive}
      onClick={(event) => {
        if (inactive) event.preventDefault()
      }}
      className={clsx(buttonClassName(variant), className)}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
