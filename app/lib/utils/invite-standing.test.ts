import { describe, expect, it } from 'vitest'
import { inviteStanding } from '@/app/lib/utils/invite-standing'

const expiresAt = new Date('2026-11-20T10:00:00Z')

describe('inviteStanding', () => {
  it('is an active invite first, with when it expires, even once people joined', () => {
    expect(
      inviteStanding({ activeInviteExpiresAt: expiresAt, usedUpInvites: 1, residents: 2 }),
    ).toEqual({ kind: 'active', expiresAt })
  })

  it('is how many joined when no invite works', () => {
    expect(inviteStanding({ activeInviteExpiresAt: null, usedUpInvites: 1, residents: 2 })).toEqual(
      { kind: 'joined', residents: 2 },
    )
  })

  it('is used up when the last invite ran out of places and no one lives there', () => {
    expect(inviteStanding({ activeInviteExpiresAt: null, usedUpInvites: 1, residents: 0 })).toEqual(
      { kind: 'used-up' },
    )
  })

  it('is none without a working or used-up invite, or anyone living there', () => {
    expect(inviteStanding({ activeInviteExpiresAt: null, usedUpInvites: 0, residents: 0 })).toEqual(
      { kind: 'none' },
    )
  })
})
