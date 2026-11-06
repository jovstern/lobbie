'use client'

import { CheckIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

type Props = {
  /** Unique on the page: the control points to it with `aria-describedby`. */
  id: string
  /** Why the last save failed, if it did. */
  message?: string | null
  /** From `useSaveOnChange`: set while the last save worked. */
  savedId?: number
}

/**
 * Beside a control that saves as it changes: "Saved" after each save that worked, or why one
 * failed, in a polite live region that is always on the page.
 */
export default function SaveStatus({ id, message, savedId }: Props) {
  const t = useTranslations('Common')

  return (
    <div id={id} aria-live="polite" aria-atomic="true">
      {message ? <p className="text-danger max-w-xs text-sm">{message}</p> : null}
      {!message && savedId !== undefined ? (
        // Keyed by the save, so the next one is announced again.
        <p key={savedId} className="text-success flex items-center gap-1 text-sm font-medium">
          <CheckIcon aria-hidden className="size-4 shrink-0" />
          {t('saved')}
        </p>
      ) : null}
    </div>
  )
}
