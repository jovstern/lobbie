import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
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

/** The part of sign-in that depends on the URL: the expired-link notice and `next`. */
export default async function SignInSection({ searchParams, locale }: Props) {
  const params = await searchParams
  const t = await getTranslations('SignIn')
  // Better Auth sends a failed link back here with `?error=<code>`: INVALID_TOKEN for one
  // that expired or was already used, another code for anything else.
  const error = single(params.error)
  const notice =
    error === undefined ? null : error === 'INVALID_TOKEN' ? t('expired') : t('signInFailed')
  const action = requestMagicLink.bind(null, { locale, next: single(params.next) })

  return (
    <>
      {notice ? (
        <p
          role="status"
          className="rounded-control border-warning-fill bg-surface text-warning flex items-start gap-2 border p-3 text-sm"
        >
          <ExclamationCircleIcon aria-hidden className="size-5 shrink-0" />
          {notice}
        </p>
      ) : null}
      <SignInForm action={action} />
    </>
  )
}
