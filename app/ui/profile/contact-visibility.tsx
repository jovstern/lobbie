'use client'

import { useTranslations } from 'next-intl'
import { startTransition, useActionState, useOptimistic } from 'react'
import type { SettingState } from '@/app/lib/actions/users'

type Props = {
  /** `setShowContact` with the page's locale bound. */
  action: (state: SettingState, formData: FormData) => Promise<SettingState>
  /** As saved. */
  showContact: boolean
  /** Without a phone, the directory can show only the email. */
  hasPhone: boolean
}

/**
 * Whether neighbours see the member's phone and email in the directory, saved as soon as it
 * changes (the save-on-change pattern): the new state shows at once, and a failed save falls
 * back to the saved one and says why.
 */
export default function ContactVisibility({ action, showContact, hasPhone }: Props) {
  const t = useTranslations('ContactVisibility')
  const initialState: SettingState = {}
  const [state, dispatch, isPending] = useActionState(action, initialState)
  const [shown, setShown] = useOptimistic(showContact)

  function change(next: boolean) {
    const formData = new FormData()
    formData.set('showContact', String(next))
    startTransition(() => {
      setShown(next)
      dispatch(formData)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-medium">
        {t('label')}
        {/* The checkbox is the switch; the track and knob beside it only draw it, so every
            browser shows the same control (Firefox draws no ::before on an input). */}
        <span className="relative inline-flex shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={shown}
            onChange={(event) => change(event.target.checked)}
            aria-describedby="show-contact-hint show-contact-status"
            aria-busy={isPending}
            className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
          />
          <span
            aria-hidden
            className="bg-text-muted peer-checked:bg-accent peer-focus-visible:outline-accent pointer-events-none h-7 w-12 rounded-full transition-[background-color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 motion-reduce:transition-none"
          />
          <span
            aria-hidden
            className="bg-surface-raised pointer-events-none absolute start-0.5 top-0.5 size-6 rounded-full shadow-sm transition-transform motion-reduce:transition-none ltr:peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
          />
        </span>
      </label>
      <div id="show-contact-hint" className="text-text-muted flex flex-col gap-1 text-sm">
        <p>{t('hint')}</p>
        {hasPhone ? null : <p>{t('noPhoneHint')}</p>}
      </div>
      <div id="show-contact-status" aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
    </div>
  )
}
