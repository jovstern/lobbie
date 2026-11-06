'use client'

import { useTranslations } from 'next-intl'
import { startTransition, useOptimistic } from 'react'
import type { OwnershipState } from '@/app/lib/actions/residents'
import { useSaveOnChange } from '@/app/ui/save-on-change'
import SaveStatus from '@/app/ui/save-status'

type Props = {
  /** `setOwnership` with the locale, the person and the apartment bound. */
  action: (state: OwnershipState, formData: FormData) => Promise<OwnershipState>
  /** As saved. */
  isOwner: boolean
  name: string
  /** Unique on the page: names the radio group. */
  userId: string
}

const choices = [
  { isOwner: true, label: 'owner' },
  { isOwner: false, label: 'tenant' },
] as const

/**
 * Owner or tenant, saved as soon as it changes (the save-on-change pattern): the new choice
 * shows at once, "Saved" follows, and a failed save falls back to the saved one and says why.
 */
export default function OwnershipToggle({ action, isOwner, name, userId }: Props) {
  const t = useTranslations('ResidentsClient')
  const [state, dispatch, isPending] = useSaveOnChange(action)
  const statusId = `ownership-status-${userId}`
  const [shownIsOwner, setShownIsOwner] = useOptimistic(isOwner)

  function choose(next: boolean) {
    const formData = new FormData()
    formData.set('isOwner', String(next))
    startTransition(() => {
      setShownIsOwner(next)
      dispatch(formData)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <fieldset aria-busy={isPending} aria-describedby={statusId}>
        <legend className="sr-only">{t('ownership', { name })}</legend>
        <div className="rounded-control border-text-muted bg-surface inline-flex border p-0.5">
          {choices.map((choice) => (
            <label
              key={choice.label}
              className="has-checked:bg-accent has-checked:text-on-accent hover:bg-surface-raised has-checked:hover:bg-accent has-focus-visible:outline-accent rounded-control flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium transition-[background-color,color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
            >
              <input
                type="radio"
                name={`ownership-${userId}`}
                value={String(choice.isOwner)}
                checked={shownIsOwner === choice.isOwner}
                onChange={() => choose(choice.isOwner)}
                className="sr-only"
              />
              {t(choice.label)}
            </label>
          ))}
        </div>
      </fieldset>
      <SaveStatus id={statusId} message={state.message} savedId={state.savedId} />
    </div>
  )
}
