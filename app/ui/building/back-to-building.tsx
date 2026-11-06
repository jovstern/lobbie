import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

/** Up one level, to the Building hub, from one of its pages. */
export default function BackToBuilding() {
  const t = useTranslations('BuildingHub')

  return (
    <Link
      href="/building"
      className="text-accent inline-flex min-h-11 items-center gap-2 self-start font-medium underline-offset-4 hover:underline"
    >
      <ArrowLeftIcon aria-hidden className="size-5 rtl:-scale-x-100" />
      {t('back')}
    </Link>
  )
}
