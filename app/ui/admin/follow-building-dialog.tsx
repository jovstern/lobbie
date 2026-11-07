import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import type { FollowBuildingState } from '@/app/lib/actions/fees'
import { formatMonth } from '@/app/lib/utils/dates'
import LazyDialogButton from '@/app/ui/admin/lazy-dialog-button'

type Props = {
  /** `followBuilding` with the locale, the apartment and the month bound. */
  action: () => Promise<FollowBuildingState>
  number: string
  /** The month it follows the building from, as `YYYY-MM`. */
  month: string
}

/**
 * "Follow the building fee" and its confirmation: ends an apartment's own fee from a month.
 * Once it is done this button leaves the page (the apartment has no own fee left to end), so
 * focus goes to the page heading and the status region says what happened. Not destructive (a
 * new own fee can be set again), so it confirms with the accent.
 */
export default function FollowBuildingDialog({ action, number, month }: Props) {
  const t = useTranslations('FollowBuilding')
  const locale = useLocale()
  const monthName = formatMonth(month, locale)

  return (
    <LazyDialogButton
      dialog={{
        kind: 'confirm',
        action,
        title: t('title', { number, month: monthName }),
        description: t('body', { month: monthName }),
        labels: { confirm: t('confirm'), pending: t('pending'), cancel: t('cancel') },
        done: t('done', { number, month: monthName }),
        variant: 'primary',
      }}
      label={t('openLabel', { number })}
      variant="ghost"
      status="announcer"
      leaves
    >
      <ArrowUturnLeftIcon aria-hidden className="size-5 rtl:-scale-x-100" />
      {t('open')}
    </LazyDialogButton>
  )
}
