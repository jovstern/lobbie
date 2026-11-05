'use client'

import { useLocale, useTranslations } from 'next-intl'
import { startTransition, useActionState, useEffect, useOptimistic, useRef } from 'react'
import type { SettingState } from '@/app/lib/actions/users'
import { routing, type Locale } from '@/i18n/routing'

type Props = {
  /** `setLocale` with the page's locale bound. */
  action: (state: SettingState, formData: FormData) => Promise<SettingState>
  /** The id of the heading that names the group. */
  labelledBy: string
}

/**
 * Hebrew or English, saved as soon as it changes (the save-on-change pattern). The page's own
 * language is the one checked. A save opens the page in the new language; a failed one falls
 * back and says why. Each language is named in itself.
 */
export default function LanguageChoice({ action, labelledBy }: Props) {
  const t = useTranslations('LanguageChoice')
  const initialState: SettingState = {}
  const [state, dispatch, isPending] = useActionState(action, initialState)
  const pageLocale = useLocale()
  const [shownLocale, setShownLocale] = useOptimistic(pageLocale)
  const groupRef = useRef<HTMLFieldSetElement>(null)

  // A saved change reloads the page at #language (see setLocale): focus returns to the choice
  // the person just made. The URL and focus are outside React.
  useEffect(() => {
    if (window.location.hash !== '#language') return
    groupRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
  }, [])

  function choose(next: Locale) {
    const formData = new FormData()
    formData.set('locale', next)
    startTransition(() => {
      setShownLocale(next)
      dispatch(formData)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset
        ref={groupRef}
        aria-labelledby={labelledBy}
        aria-describedby="language-hint language-status"
        aria-busy={isPending}
      >
        <div className="rounded-control border-text-muted bg-surface inline-flex border p-0.5">
          {routing.locales.map((option) => (
            <label
              key={option}
              lang={option}
              className="has-checked:bg-accent has-checked:text-on-accent hover:bg-surface-raised has-checked:hover:bg-accent has-focus-visible:outline-accent rounded-control flex min-h-11 cursor-pointer items-center px-5 font-medium transition-[background-color,color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
            >
              <input
                type="radio"
                name="locale"
                value={option}
                checked={shownLocale === option}
                onChange={() => choose(option)}
                className="sr-only"
              />
              {t(option)}
            </label>
          ))}
        </div>
      </fieldset>
      <p id="language-hint" className="text-text-muted text-sm">
        {t('hint')}
      </p>
      <div id="language-status" aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
    </div>
  )
}
