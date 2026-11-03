import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const sentAddress = z.email()

/**
 * Where the link went, from the `?email=` the sign-in action adds. Anything that is not an
 * address gets the general sentence, so the page shows only what the person typed.
 */
export default async function SentTo({ searchParams }: Props) {
  const [{ email }, t] = await Promise.all([searchParams, getTranslations('CheckEmail')])
  const parsed = sentAddress.safeParse(email)
  if (!parsed.success) return <p>{t('body')}</p>

  return (
    <p>
      {t.rich('sentTo', {
        email: parsed.data,
        // Isolated, so the Hebrew sentence's punctuation stays on its side of the address.
        address: (chunks) => (
          <bdi dir="ltr" className="font-medium">
            {chunks}
          </bdi>
        ),
      })}
    </p>
  )
}
