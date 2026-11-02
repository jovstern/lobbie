import { describe, expect, it } from 'vitest'
import { addMonths, currentMonthIn, todayIn } from './dates'

describe('todayIn', () => {
  it.each([
    ['2026-11-02T10:00:00Z', '2026-11-02'],
    // Israel is UTC+2 in winter: 23:30 there is still 31 October; 00:30 is already November.
    ['2026-10-31T21:30:00Z', '2026-10-31'],
    ['2026-10-31T22:30:00Z', '2026-11-01'],
    ['2026-12-31T22:30:00Z', '2027-01-01'],
    // Summer (UTC+3): 23:30 on 31 July is still July; 00:30 is August.
    ['2026-07-31T20:30:00Z', '2026-07-31'],
    ['2026-07-31T21:30:00Z', '2026-08-01'],
    // Summer time starts Friday 27 March 2026 at 02:00 (the last Friday before 2 April).
    ['2026-03-26T21:59:00Z', '2026-03-26'],
    ['2026-03-26T22:30:00Z', '2026-03-27'],
    ['2026-03-27T20:30:00Z', '2026-03-27'],
    ['2026-03-27T21:30:00Z', '2026-03-28'],
    // Summer time ends Sunday 25 October 2026 at 02:00 (the last Sunday of October).
    ['2026-10-24T20:59:00Z', '2026-10-24'],
    ['2026-10-24T21:30:00Z', '2026-10-25'],
    ['2026-10-25T21:30:00Z', '2026-10-25'],
    ['2026-10-25T22:30:00Z', '2026-10-26'],
  ])('%s is %s in Jerusalem', (instant, expected) => {
    expect(todayIn('Asia/Jerusalem', new Date(instant))).toBe(expected)
  })
})

describe('currentMonthIn', () => {
  it.each([
    ['2026-11-02T10:00:00Z', '2026-11'],
    // 31 October at 23:30 in Israel is still October; 00:30 on 1 November (still 31 October
    // in UTC) is November.
    ['2026-10-31T21:30:00Z', '2026-10'],
    ['2026-10-31T22:30:00Z', '2026-11'],
    ['2026-12-31T22:30:00Z', '2027-01'],
  ])('%s is %s in Jerusalem', (instant, expected) => {
    expect(currentMonthIn('Asia/Jerusalem', new Date(instant))).toBe(expected)
  })
})

describe('addMonths', () => {
  it.each([
    ['2026-11', -12, '2025-11'],
    ['2026-01', -1, '2025-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-05', 0, '2026-05'],
    ['2024-02', 25, '2026-03'],
  ])('%s %+i is %s', (month, delta, expected) => {
    expect(addMonths(month, delta)).toBe(expected)
  })
})
