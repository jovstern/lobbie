import { describe, expect, it } from 'vitest'
import {
  inviteStatus,
  joiningApartment,
  joinView,
  type InvitePreview,
  type JoinMembership,
} from './join-view'

describe('inviteStatus', () => {
  it.each([
    [{ revoked: false, expired: false, full: false }, 'valid'],
    [{ revoked: false, expired: false, full: true }, 'full'],
    [{ revoked: false, expired: true, full: false }, 'expired'],
    [{ revoked: false, expired: true, full: true }, 'expired'],
    [{ revoked: true, expired: true, full: true }, 'revoked'],
  ] as const)('%j is %s', (flags, expected) => {
    expect(inviteStatus(flags)).toBe(expected)
  })
})

const preview: InvitePreview = {
  status: 'valid',
  buildingId: 'b1',
  buildingName: 'Rimon 12',
  apartmentId: 'a7',
  apartmentNumber: '7',
}
const signedOut: JoinMembership = { status: 'signed-out' }
const noMembership: JoinMembership = { status: 'no-membership' }
const member = (buildingId: string, apartmentIds: string[]): JoinMembership => ({
  status: 'member',
  buildingId,
  buildingName: buildingId === 'b1' ? 'Rimon 12' : 'Elsewhere 3',
  apartmentIds,
})

describe('joinView', () => {
  it('says an unknown code is not valid, whoever asks', () => {
    expect(joinView(null, signedOut)).toEqual({ kind: 'invalid' })
    expect(joinView(null, member('b1', ['a1']))).toEqual({ kind: 'invalid' })
  })

  it('asks a signed-out visitor to sign in first, with the apartment it opens', () => {
    expect(joinView(preview, signedOut)).toEqual({
      kind: 'sign-in',
      buildingName: 'Rimon 12',
      apartmentNumber: '7',
    })
  })

  it('offers to join to someone without a building', () => {
    expect(joinView(preview, noMembership)).toEqual({
      kind: 'valid',
      buildingName: 'Rimon 12',
      apartmentNumber: '7',
    })
  })

  it('offers a member of the building a second apartment', () => {
    expect(joinView(preview, member('b1', ['a1'])).kind).toBe('valid')
  })

  it('sends someone already in the apartment home, even when the invite has ended', () => {
    const view = { kind: 'already-member', buildingName: 'Rimon 12', apartmentNumber: '7' }
    expect(joinView(preview, member('b1', ['a7']))).toEqual(view)
    expect(joinView({ ...preview, status: 'expired' }, member('b1', ['a7']))).toEqual(view)
  })

  it('refuses a member of another building, naming their own', () => {
    expect(joinView(preview, member('b2', ['x']))).toEqual({
      kind: 'other-building',
      buildingName: 'Elsewhere 3',
    })
  })

  it.each(['expired', 'full', 'revoked'] as const)(
    'shows a %s invite as such, without its apartment',
    (status) => {
      expect(joinView({ ...preview, status }, signedOut)).toEqual({ kind: status })
      expect(joinView({ ...preview, status }, noMembership)).toEqual({ kind: status })
    },
  )
})

describe('joiningApartment', () => {
  it('names the apartment on the way back to an invite, in either language', () => {
    expect(joiningApartment('/join/ABCDE23456', '12')).toBe('12')
    expect(joiningApartment('/en/join/ABCDE23456', '12A')).toBe('12A')
    expect(joiningApartment('/join/ABCDE23456', 'א-3')).toBe('א-3')
  })

  it.each([
    ['no next', undefined, '12'],
    ['no apartment', '/join/ABCDE23456', undefined],
    ['code entry, not an invite', '/join', '12'],
    ['another page', '/profile', '12'],
    ['another site', '//evil.example/join/x', '12'],
    ['a sentence', '/join/ABCDE23456', 'call 050-0000000'],
    ['markup', '/join/ABCDE23456', '<b>1</b>'],
    ['a list', '/join/ABCDE23456', ['12', '13']],
  ])('is null for %s', (_case, next, apartment) => {
    expect(joiningApartment(next, apartment)).toBeNull()
  })
})
