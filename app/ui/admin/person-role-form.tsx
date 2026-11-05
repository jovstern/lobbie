'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RoleFormState } from '@/app/lib/actions/members'
import type { Role } from '@/app/lib/definitions'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

export type RoleAction = (state: RoleFormState, formData: FormData) => Promise<RoleFormState>

export type RoleValues = { role: Role; committeeTitle: string }

type Props = {
  /** `setRole` with the locale and the person's id bound. */
  action: RoleAction
  saved: RoleValues
  /** Whether this is the signed-in admin: giving up the admin role is warned about. */
  isSelf: boolean
  /** Called once the role is saved. */
  onSaved: () => void
  /** The dialog's close button, placed beside the submit button. */
  cancel: ReactNode
}

const roles = ['resident', 'committee', 'admin'] as const satisfies readonly Role[]
const hints = {
  resident: 'residentHint',
  committee: 'committeeHint',
  admin: 'adminHint',
} as const satisfies Record<Role, string>
const fieldOrder = ['role', 'committeeTitle'] as const

/** A person's role and, for the committee and admins, their committee title (R10). */
export default function PersonRoleForm({ action, saved, isSelf, onSaved, cancel }: Props) {
  const t = useTranslations('PersonRole')
  const tRoles = useTranslations('Roles')
  const initialState: RoleFormState = {}
  const [state, formAction] = useActionState(
    async (previous: RoleFormState, formData: FormData) => {
      const next = await action(previous, formData)
      if (next.saved) onSaved()
      return next
    },
    initialState,
  )
  // Which role is chosen, so the title field shows only for roles that have one. The radios
  // themselves stay uncontrolled: React resets the form after the action, and only defaults
  // (what was sent, after a refusal) survive that.
  const [role, setRole] = useState<Role>(saved.role)
  const sentRole = state.values?.role ?? saved.role
  const formRef = useRef<HTMLFormElement>(null)
  const roleErrors = state.errors?.role

  // Focus is the DOM's, outside React: after a failed save it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <fieldset aria-describedby="role-error" className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('role')}</legend>
        <div className="flex flex-col gap-2">
          {roles.map((option) => (
            <label
              key={option}
              className={clsx(
                'rounded-control hover:border-text has-checked:border-accent has-checked:bg-surface has-focus-visible:outline-accent flex min-h-11 cursor-pointer items-start gap-3 border px-3 py-2 transition-[background-color,border-color,color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                roleErrors ? 'border-danger' : 'border-text-muted',
              )}
            >
              <input
                type="radio"
                name="role"
                value={option}
                required
                defaultChecked={sentRole === option}
                onChange={() => setRole(option)}
                // The role alone names it; its hint describes it.
                aria-labelledby={`role-${option}-label`}
                aria-describedby={`role-${option}-hint`}
                className="accent-accent mt-1 size-4 shrink-0 focus-visible:outline-none"
              />
              <span className="flex flex-col">
                <span id={`role-${option}-label`} className="font-medium">
                  {tRoles(option)}
                </span>
                <span id={`role-${option}-hint`} className="text-text-muted text-sm">
                  {t(hints[option])}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div id="role-error" aria-live="polite" aria-atomic="true">
          {roleErrors?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </fieldset>
      {role === 'resident' ? null : (
        <TextField
          name="committeeTitle"
          label={t('committeeTitle')}
          hint={t('committeeTitleHint')}
          defaultValue={state.values?.committeeTitle ?? saved.committeeTitle}
          errors={state.errors?.committeeTitle}
          maxLength={40}
          autoComplete="off"
        />
      )}
      {/* Polite, so the choice is read first, then what it will do. */}
      <div aria-live="polite" aria-atomic="true">
        {isSelf && saved.role === 'admin' && role !== 'admin' ? (
          <p className="text-warning border-warning rounded-control flex items-start gap-2 border p-3 text-sm font-medium">
            <ExclamationTriangleIcon aria-hidden className="size-5 shrink-0" />
            {t('selfDemoteWarning')}
          </p>
        ) : null}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton pendingLabel={t('saving')}>{t('save')}</SubmitButton>
      </div>
    </form>
  )
}
