/** Whether an invite can still be used, and if not, why. */
export type InviteStatus = 'valid' | 'expired' | 'full' | 'revoked'

/** What the database says of an invite, measured against its own clock. */
export type InviteFlags = { revoked: boolean; expired: boolean; full: boolean }

/** The most final reason first: a revoked invite stays revoked, an expired one never refills. */
export function inviteStatus({ revoked, expired, full }: InviteFlags): InviteStatus {
  if (revoked) return 'revoked'
  if (expired) return 'expired'
  if (full) return 'full'
  return 'valid'
}

/** An invite as the join page knows it, found by its code. */
export type InvitePreview = {
  status: InviteStatus
  buildingId: string
  buildingName: string
  apartmentId: string
  apartmentNumber: string
}

/** Who opened the link (see `getMembership`), with only what the join page needs. */
export type JoinMembership =
  | { status: 'signed-out' }
  | { status: 'no-membership' }
  | { status: 'member'; buildingId: string; buildingName: string; apartmentIds: string[] }

/** What `/join/[code]` shows (spec §6). */
export type JoinView =
  | { kind: 'invalid' | 'expired' | 'full' | 'revoked' }
  | { kind: 'sign-in' | 'valid' | 'already-member'; buildingName: string; apartmentNumber: string }
  | { kind: 'other-building'; buildingName: string }
  | { kind: 'rate-limited'; minutes: number }

/**
 * The join page's state. An invite that cannot be used names no building or apartment: the
 * code may be old, forwarded or guessed. Someone already in the apartment is simply sent home,
 * and one building per user (spec §3) refuses a member of another building.
 */
export function joinView(preview: InvitePreview | null, membership: JoinMembership): JoinView {
  if (!preview) return { kind: 'invalid' }
  const { buildingName, apartmentNumber } = preview

  if (membership.status === 'member') {
    if (membership.buildingId !== preview.buildingId) {
      return { kind: 'other-building', buildingName: membership.buildingName }
    }
    if (membership.apartmentIds.includes(preview.apartmentId)) {
      return { kind: 'already-member', buildingName, apartmentNumber }
    }
  }
  if (preview.status !== 'valid') return { kind: preview.status }
  if (membership.status === 'signed-out') return { kind: 'sign-in', buildingName, apartmentNumber }
  return { kind: 'valid', buildingName, apartmentNumber }
}
