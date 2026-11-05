'use client'

import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

type Props = {
  /** What goes to the clipboard. */
  text: string
  /** The button's visible text. */
  label: string
  /** A fuller name for screen readers, when the visible text needs its context. */
  accessibleLabel?: string
  /** The element that shows the text: selected for a manual copy when the clipboard fails. */
  sourceId: string
  variant?: ButtonVariant
}

// The clipboard can be missing (an insecure origin, an old browser) or refused; the person can
// still copy the selected text themselves.
function selectContents(id: string) {
  const source = document.getElementById(id)
  const selection = window.getSelection()
  if (!source || !selection) return
  const range = document.createRange()
  range.selectNodeContents(source)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Copies `text`, and says so in a polite live region beside the button. */
export default function CopyButton({
  text,
  label,
  accessibleLabel,
  sourceId,
  variant = 'secondary',
}: Props) {
  const t = useTranslations('CopyButton')
  // Keyed by a count, so a second copy is announced again.
  const [result, setResult] = useState<{ copied: boolean; id: number } | null>(null)

  async function copy() {
    const id = (result?.id ?? 0) + 1
    try {
      await navigator.clipboard.writeText(text)
      setResult({ copied: true, id })
    } catch {
      selectContents(sourceId)
      setResult({ copied: false, id })
    }
  }

  return (
    // Not selectable, so selecting a list of links for a manual copy takes only the links.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 select-none">
      <button
        type="button"
        onClick={copy}
        aria-label={accessibleLabel}
        className={buttonClassName(variant)}
      >
        <ClipboardDocumentIcon aria-hidden className="size-5" />
        {label}
      </button>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm">
        {result ? (
          <span
            key={result.id}
            className={clsx(
              'flex items-center gap-1 font-medium',
              result.copied ? 'text-success' : 'text-danger',
            )}
          >
            {result.copied ? <CheckIcon aria-hidden className="size-4 shrink-0" /> : null}
            {result.copied ? t('copied') : t('copyFailed')}
          </span>
        ) : null}
      </p>
    </div>
  )
}
