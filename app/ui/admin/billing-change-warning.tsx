import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useId, type Ref } from 'react'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** The form focuses it when it appears. */
  ref: Ref<HTMLDivElement>
  title: string
  /** What the change does, in words. */
  body: string
  /** The form action that saves with the change confirmed. */
  onConfirm: (formData: FormData) => void
  /** The confirming button's text. */
  label: string
}

/**
 * Asks before a new billing start month is saved, since that changes what is owed, past months
 * included. It is announced by taking focus, as a group named by its title and described by its
 * body; it is deliberately not a live region too, which would announce it twice.
 */
export default function BillingChangeWarning({ ref, title, body, onConfirm, label }: Props) {
  const id = useId()
  const titleId = `${id}-title`
  const bodyId = `${id}-body`

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="rounded-control border-warning-fill bg-surface flex flex-col gap-3 border p-4"
    >
      <p id={titleId} className="text-warning flex items-center gap-2 font-semibold">
        <ExclamationTriangleIcon aria-hidden className="size-5 shrink-0" />
        {title}
      </p>
      <p id={bodyId}>{body}</p>
      <div>
        <button type="submit" formAction={onConfirm} className={buttonClassName('secondary')}>
          {label}
        </button>
      </div>
    </div>
  )
}
