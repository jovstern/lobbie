'use client'

import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { startTransition, useEffect, useOptimistic, useRef, useSyncExternalStore } from 'react'
import type { SettingState } from '@/app/lib/actions/users'
import { useSaveOnChange } from '@/app/ui/save-on-change'
import SaveStatus from '@/app/ui/save-status'
import { routing, type Locale } from '@/i18n/routing'

type Props = {
  /** `setLocale` with the page's locale bound. */
  action: (state: SettingState, formData: FormData) => Promise<SettingState>
  /** The id of the heading that names the group. */
  labelledBy: string
}

// A saved change reloads the page at #language (see setLocale). The hash is outside React, and
// the server has none, so the first render on the client matches the server's.
const landing = '#language'
const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
const isLanding = () => window.location.hash === landing
const notLanding = () => false

/**
 * Hebrew or English, saved as soon as one is pressed (the save-on-change pattern). Two toggle
 * buttons, not radios: arrow keys move between radios and would switch the whole page's
 * language on the way. The page's own language is the pressed one. A save opens the page in
 * the new language, back at this choice, which says "Saved"; a failed one falls back and says
 * why. Each language is named in itself.
 */
export default function LanguageChoice({ action, labelledBy }: Props) {
  const t = useTranslations('LanguageChoice')
  const [state, dispatch, isPending] = useSaveOnChange(action)
  const pageLocale = useLocale()
  const [shownLocale, setShownLocale] = useOptimistic(pageLocale)
  const groupRef = useRef<HTMLDivElement>(null)
  const justChanged = useSyncExternalStore(subscribeToHash, isLanding, notLanding)

  // Focus is the DOM's, outside React: after a change it returns to the language just chosen.
  useEffect(() => {
    if (!isLanding()) return
    groupRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  }, [])

  function choose(next: Locale) {
    if (next === shownLocale) return
    const formData = new FormData()
    formData.set('locale', next)
    startTransition(() => {
      setShownLocale(next)
      dispatch(formData)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={groupRef}
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby="language-hint language-status"
        aria-busy={isPending}
        className="rounded-control border-text-muted bg-surface inline-flex self-start border p-0.5"
      >
        {routing.locales.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={shownLocale === option}
            onClick={() => choose(option)}
            className={clsx(
              'rounded-control focus-visible:outline-accent flex min-h-11 items-center px-5 font-medium transition-[background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2',
              'aria-pressed:bg-accent aria-pressed:text-on-accent hover:bg-surface-raised aria-pressed:hover:bg-accent',
            )}
          >
            {t(option)}
          </button>
        ))}
      </div>
      <p id="language-hint" className="text-text-muted text-sm">
        {t('hint')}
      </p>
      <SaveStatus
        id="language-status"
        message={state.message}
        // The save itself ends in a new page, which says so on arrival.
        savedId={justChanged && !state.message ? 0 : undefined}
      />
    </div>
  )
}
