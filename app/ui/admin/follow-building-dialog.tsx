'use client'

import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useRef } from 'react'
import type { FollowBuildingState } from '@/app/lib/actions/fees'
import { formatMonth } from '@/app/lib/utils/dates'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

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
 * focus goes to the page heading and the status region says what happened.
 */
export default function FollowBuildingDialog({ action, number, month }: Props) {
  const t = useTranslations('FollowBuilding')
  const locale = useLocale()
  const { announce, focusHeading } = useAnnouncer()
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const done = useRef(false)
  const dialog = useLazyDialog({
    preload: preloadConfirmDialog,
    moveFocusOnClose: () => {
      if (done.current) focusHeading()
      return done.current
    },
  })
  const monthName = formatMonth(month, locale)

  return (
    <>
      <button
        {...dialog.trigger}
        aria-label={t('openLabel', { number })}
        className={buttonClassName('secondary')}
      >
        <ArrowUturnLeftIcon aria-hidden className="size-5 rtl:-scale-x-100" />
        {t('open')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <ConfirmDialogContent
          {...dialog.content}
          title={t('title', { number, month: monthName })}
          description={t('body', { month: monthName })}
          confirm={async () => {
            const state = await action()
            return { message: state.message, done: state.done === true }
          }}
          onDone={() => {
            done.current = true
            dialog.setOpen(false)
            announce(t('done', { number, month: monthName }))
          }}
          confirmLabel={t('confirm')}
          pendingLabel={t('pending')}
          cancelLabel={t('cancel')}
        />
      </LazyDialogSlot>
    </>
  )
}
