import type { ApartmentListItem } from '@/app/lib/definitions'

/** How an apartment stands on invites, as the apartments list shows it. */
export type InviteStanding =
  | { kind: 'active'; expiresAt: Date }
  | { kind: 'joined'; residents: number }
  | { kind: 'used-up' }
  | { kind: 'none' }

type InviteFacts = Pick<ApartmentListItem, 'activeInviteExpiresAt' | 'usedUpInvites' | 'residents'>

/**
 * What the admin needs to know next: a link that still works (and until when) comes first;
 * otherwise whether people have joined; otherwise whether the last link ran out of places, or
 * there has never been a working one.
 */
export function inviteStanding({
  activeInviteExpiresAt,
  usedUpInvites,
  residents,
}: InviteFacts): InviteStanding {
  if (activeInviteExpiresAt) return { kind: 'active', expiresAt: activeInviteExpiresAt }
  if (residents > 0) return { kind: 'joined', residents }
  if (usedUpInvites > 0) return { kind: 'used-up' }
  return { kind: 'none' }
}
