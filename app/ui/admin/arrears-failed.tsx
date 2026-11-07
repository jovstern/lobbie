'use client'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { buttonClassName } from '@/app/ui/button-styles'
import { cardClassName } from '@/app/ui/card'

type Props = {
  /** The list's title, as when it loads. */
  title: string
  /** What failed, from the server's messages. */
  message: string
  retry: () => void
}

/**
 * Who is behind, when it could not load: the same card, saying so, with a retry. The rest of
 * the page (the way to record a payment, the links) stays usable.
 */
export default function ArrearsFailed({ title, message, retry }: Props) {
  const t = useTranslations('ErrorPage')

  return (
    <section aria-labelledby="arrears-title" className={cardClassName}>
      <h2 id="arrears-title" className="text-lg font-semibold">
        {title}
      </h2>
      <p role="alert" className="text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className={`${buttonClassName('secondary')} self-start`}
      >
        <ArrowPathIcon aria-hidden className="size-5" />
        {t('retry')}
      </button>
    </section>
  )
}
