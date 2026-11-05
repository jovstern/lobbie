import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { requestMagicLink } from '@/app/lib/actions/auth'
import SignInForm from '@/app/ui/auth/sign-in-form'
import type { Locale } from '@/i18n/routing'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  locale: Locale
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The part of sign-in that depends on the URL: the failed-link notice, `next`, and whether
 * the field takes focus. After signing out or a failed sign-in, typing is the next step; an
 * expired link's notice is read first, so focus stays at the top.
 */
export default async function SignInSection({ searchParams, locale }: Props) {
  const params = await searchParams
  const t = await getTranslations('SignIn')
  // Better Auth sends a failed link back here with `?error=<code>`: INVALID_TOKEN for one
  // that expired or was already used, another code for anything else.
  const error = single(params.error)
  const expired = error === 'INVALID_TOKEN'
  const action = requestMagicLink.bind(null, { locale, next: single(params.next) })
  const signedOut = single(params.signedOut) === '1'

  return (
    <>
      {error === undefined ? null : (
        <p
          role="status"
          className={clsx(
            'rounded-control bg-surface flex items-start gap-2 border p-3 text-sm',
            expired ? 'border-warning-fill text-warning' : 'border-danger text-danger',
          )}
        >
          <ExclamationCircleIcon aria-hidden className="size-5 shrink-0" />
          {expired ? t('expired') : t('signInFailed')}
        </p>
      )}
      <SignInForm action={action} autoFocus={signedOut || (error !== undefined && !expired)} />
    </>
  )
}
