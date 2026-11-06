import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { ownApartmentNumber } from '@/app/ui/home/status-card'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * "You joined apartment 12", once, on the Home a redemption lands on (`?joined=<id>`). Only an
 * apartment of the person's own is named, so the URL cannot make it say anything else; leaving
 * Home drops the flag, and with it the welcome.
 */
export default async function JoinedWelcome({ searchParams }: Props) {
  const { joined } = await searchParams
  if (typeof joined !== 'string') return null
  const [number, t] = await Promise.all([ownApartmentNumber(joined), getTranslations('Home')])
  if (number === null) return null

  return (
    <p
      role="status"
      className="rounded-card border-success bg-surface-raised text-success flex items-center gap-2 border p-4 font-medium lg:col-span-2"
    >
      <CheckCircleIcon aria-hidden className="size-6 shrink-0" />
      {t('joined', { number })}
    </p>
  )
}
