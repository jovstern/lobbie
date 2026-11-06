'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { buttonClassName } from '@/app/ui/button-styles'
import TextField from '@/app/ui/text-field'
import { usePathname, useRouter } from '@/i18n/navigation'

const fieldId = 'q'

type Props = {
  /** The search the page shows, from the URL. */
  query: string
  label: string
  /** What can be searched for, read with the label. */
  hint: string
}

/**
 * A list's search: what is typed goes to `?q=` after a pause. "Clear" sits beside the field,
 * outside the results that reload, so focus stays here. The field follows the URL when back
 * or forward changes it, but never undoes typing that is still on its way.
 */
export default function SearchField({ query, label, hint }: Props) {
  const t = useTranslations('Search')
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()
  const [value, setValue] = useState(query)
  // The last search sent, and the URL's search last seen: React's "adjusting state when a
  // prop changes", so an outside change reaches the field without an effect.
  const [sent, setSent] = useState(query)
  const [seenQuery, setSeenQuery] = useState(query)

  function go(term: string) {
    const params = new URLSearchParams(searchParams)
    if (term) params.set('q', term)
    else params.delete('q')
    setSent(term)
    const queryString = params.toString()
    replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  const search = useDebouncedCallback((term: string) => go(term.trim()), 300)

  if (query !== seenQuery) {
    setSeenQuery(query)
    if (query !== sent) {
      // Back or forward: typing still waiting to be sent would bring the old search back.
      search.cancel()
      setValue(query)
      setSent(query)
    }
  }

  function clear() {
    search.cancel()
    setValue('')
    go('')
    document.getElementById(fieldId)?.focus()
  }

  return (
    <div role="search" className="flex max-w-md items-start gap-2">
      <div className="min-w-0 flex-1">
        <TextField
          name={fieldId}
          type="search"
          label={label}
          hint={hint}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            search(event.target.value)
          }}
          autoComplete="off"
          maxLength={100}
        />
      </div>
      {value || query ? (
        // Below the label, level with the field.
        <button
          type="button"
          onClick={clear}
          aria-label={t('clearLabel')}
          className={`${buttonClassName('secondary')} mt-7 shrink-0`}
        >
          <XMarkIcon aria-hidden className="size-5" />
          {t('clear')}
        </button>
      ) : null}
    </div>
  )
}
