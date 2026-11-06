'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import type { CreatedInvite as CreatedInviteData } from '@/app/lib/definitions'
import CopyButton from '@/app/ui/copy-button'

/**
 * The link and code of an invite just created: shown this once, from the action's answer. It
 * appears only after a create, so it takes the focus as it mounts: the button that created it
 * may be gone, and the new link is what the admin came for.
 */
export default function CreatedInvite({ invite }: { invite: CreatedInviteData }) {
  const t = useTranslations('InviteAdminClient')
  const linkId = `invite-link-${invite.apartmentId}`
  const ref = useRef<HTMLDivElement>(null)

  // Focus is the DOM's, outside React.
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby="created-invite-title"
      aria-describedby="created-invite-lead"
      className="rounded-control border-accent bg-surface flex flex-col gap-3 border p-4"
    >
      <div className="flex flex-col gap-1">
        <p id="created-invite-title" className="font-semibold">
          {t('newTitle')}
        </p>
        <p id="created-invite-lead" className="text-text-muted text-sm">
          {t('newLead')}
        </p>
      </div>
      <dl className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-text-muted text-sm">{t('link')}</dt>
          {/* Links read left to right, also on the Hebrew page. */}
          <dd id={linkId} dir="ltr" className="text-start font-medium break-all">
            {invite.link}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-text-muted text-sm">{t('code')}</dt>
          <dd dir="ltr" className="text-start font-medium tracking-wider tabular-nums">
            {invite.code}
          </dd>
        </div>
      </dl>
      <CopyButton text={invite.link} label={t('copyLink')} sourceId={linkId} variant="primary" />
    </div>
  )
}
