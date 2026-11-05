import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import he from '@/messages/he.json'
import { blockersOf, describeBlockers } from './apartment-blockers'

describe('blockersOf', () => {
  it.each([
    [{ residents: 0, activeInvites: 0, payments: 0, feeOverrides: 0 }, []],
    [
      { residents: 2, activeInvites: 0, payments: 0, feeOverrides: 0 },
      [{ kind: 'residents', count: 2 }],
    ],
    [{ residents: 0, activeInvites: 0, payments: 5, feeOverrides: 0 }, [{ kind: 'payments' }]],
    [{ residents: 0, activeInvites: 0, payments: 0, feeOverrides: 1 }, [{ kind: 'feeOverrides' }]],
    [{ residents: 0, activeInvites: 1, payments: 0, feeOverrides: 0 }, [{ kind: 'activeInvites' }]],
    [
      { residents: 1, activeInvites: 2, payments: 3, feeOverrides: 2 },
      [
        { kind: 'residents', count: 1 },
        { kind: 'activeInvites' },
        { kind: 'payments' },
        { kind: 'feeOverrides' },
      ],
    ],
  ])('%j blocks with %j', (counts, expected) => {
    expect(blockersOf(counts)).toEqual(expected)
  })
})

describe('describeBlockers', () => {
  const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'ApartmentBlockers' })
  const tHe = createTranslator({ locale: 'he', messages: he, namespace: 'ApartmentBlockers' })

  it('says what to do about residents, in the plural the count needs', () => {
    expect(describeBlockers(tEn, [{ kind: 'residents', count: 2 }])).toBe(
      'Move or remove its 2 residents first.',
    )
    expect(describeBlockers(tEn, [{ kind: 'residents', count: 1 }])).toBe(
      'Move or remove its resident first.',
    )
    expect(describeBlockers(tHe, [{ kind: 'residents', count: 2 }])).toBe(
      'קודם צריך להעביר או להסיר את 2 הדיירים שלה.',
    )
  })

  it('joins several reasons into one description', () => {
    expect(
      describeBlockers(tEn, [
        { kind: 'residents', count: 3 },
        { kind: 'payments' },
        { kind: 'feeOverrides' },
      ]),
    ).toBe(
      `Move or remove its 3 residents first. ${en.ApartmentBlockers.payments} ${en.ApartmentBlockers.feeOverrides}`,
    )
  })
})
