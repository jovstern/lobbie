import { EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { telHref } from '@/app/lib/utils/directory'

const linkClassName =
  'text-accent inline-flex min-h-11 min-w-0 items-center gap-2 font-medium underline-offset-4 hover:underline'

type Props = { phone: string | null; email: string | null }

/**
 * A phone number and an email as links that call or write, each as large as a fingertip.
 * Both read left to right in either language. Nothing at all when both are missing.
 */
export default function ContactLinks({ phone, email }: Props) {
  const t = useTranslations('Contact')
  if (!phone && !email) return null

  return (
    <ul className="flex flex-wrap gap-x-5">
      {phone ? (
        <li className="min-w-0">
          <a href={telHref(phone)} className={linkClassName}>
            <PhoneIcon aria-hidden className="size-5 shrink-0" />
            <span className="sr-only">{t('phone')}</span>{' '}
            <bdi dir="ltr" className="tabular-nums">
              {phone}
            </bdi>
          </a>
        </li>
      ) : null}
      {email ? (
        <li className="min-w-0">
          <a href={`mailto:${email}`} className={linkClassName}>
            <EnvelopeIcon aria-hidden className="size-5 shrink-0" />
            <span className="sr-only">{t('email')}</span>{' '}
            <bdi dir="ltr" className="break-all">
              {email}
            </bdi>
          </a>
        </li>
      ) : null}
    </ul>
  )
}
