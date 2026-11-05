import { describe, expect, it } from 'vitest'
import { groupByFloor, telHref, type DirectoryRow } from './directory'

function row(apartmentId: string, floor: number, name: string): DirectoryRow {
  return {
    apartmentId,
    number: apartmentId,
    floor,
    resident: { userId: name, name, isOwner: false, phone: null, email: null },
  }
}

describe('groupByFloor', () => {
  it('is no floors for no rows', () => {
    expect(groupByFloor([])).toEqual([])
  })

  it('groups the rows by floor, then apartment, keeping their order', () => {
    const floors = groupByFloor([
      row('1', 0, 'Ana'),
      row('1', 0, 'Ben'),
      row('2', 0, 'Dan'),
      row('10', 1, 'Eli'),
    ])

    expect(
      floors.map(({ floor, apartments }) => ({
        floor,
        apartments: apartments.map((a) => [a.number, a.residents.map((r) => r.name)]),
      })),
    ).toEqual([
      {
        floor: 0,
        apartments: [
          ['1', ['Ana', 'Ben']],
          ['2', ['Dan']],
        ],
      },
      { floor: 1, apartments: [['10', ['Eli']]] },
    ])
  })

  it('gives an apartment whose row has no resident no residents', () => {
    const [floor] = groupByFloor([{ ...row('1', 2, 'Ana'), resident: null }, row('2', 2, 'Ben')])

    expect(floor.apartments.map((a) => [a.number, a.residents.length])).toEqual([
      ['1', 0],
      ['2', 1],
    ])
  })
})

describe('telHref', () => {
  it.each([
    ['050-555 0101', 'tel:0505550101'],
    [' +972 50-5550101 ', 'tel:+972505550101'],
    ['(03) 555-0101', 'tel:035550101'],
  ])('%s → %s', (phone, href) => {
    expect(telHref(phone)).toBe(href)
  })
})
