import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { sentToCookie } from '@/app/lib/utils/sent-to'

const sentAddress = z.email()

/**
 * Where the link went, from the flash cookie the sign-in action sets. Without it (expired, or
 * the page opened directly) the general sentence stands.
 */
export default async function SentTo() {
  const [cookieStore, t] = await Promise.all([cookies(), getTranslations('CheckEmail')])
  const parsed = sentAddress.safeParse(cookieStore.get(sentToCookie.name)?.value)
  if (!parsed.success) return <p>{t('body')}</p>

  return (
    <p>
      {t.rich('sentTo', {
        email: parsed.data,
        // Isolated, so the Hebrew sentence's punctuation stays on its side of the address;
        // a long address breaks anywhere instead of widening the card.
        address: (chunks) => (
          <bdi dir="ltr" className="font-medium break-all">
            {chunks}
          </bdi>
        ),
      })}
    </p>
  )
}
