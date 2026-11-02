import { describe, expect, it } from 'vitest'
import { withTimeZones } from './auth-schema-timestamptz'

describe('withTimeZones', () => {
  it.each([
    [
      `timestamp("expires_at").notNull()`,
      `timestamp("expires_at", { withTimezone: true }).notNull()`,
    ],
    [`timestamp('created_at')`, `timestamp('created_at', { withTimezone: true })`],
  ])('makes %s a timestamptz', (input, expected) => {
    expect(withTimeZones(input)).toBe(expected)
  })

  it('leaves columns that already have options alone', () => {
    const done = `timestamp('created_at', { withTimezone: true })`
    expect(withTimeZones(done)).toBe(done)
  })

  it('leaves other column types alone', () => {
    expect(withTimeZones(`text("token")`)).toBe(`text("token")`)
  })
})
