import { describe, expect, it } from 'vitest'
import { pgError } from './pg-error'

class DriverError extends Error {
  constructor(
    readonly code: string,
    readonly fields: Record<string, string>,
  ) {
    super('driver')
    Object.assign(this, fields)
  }
}

describe('pgError', () => {
  it("reads PGlite's constraint field", () => {
    const err = new DriverError('23505', { constraint: 'apartments_building_id_number_unique' })
    expect(pgError(err)).toEqual({
      code: '23505',
      constraint: 'apartments_building_id_number_unique',
    })
  })

  it("reads postgres-js's constraint_name, behind Drizzle's wrapper", () => {
    const driver = new DriverError('23503', { constraint_name: 'payments_apartment_building_fk' })
    const wrapped = new Error('Failed query', { cause: driver })
    expect(pgError(wrapped)).toEqual({
      code: '23503',
      constraint: 'payments_apartment_building_fk',
    })
  })

  it('is null for an error that did not come from Postgres', () => {
    expect(pgError(new Error('timeout'))).toBeNull()
    expect(pgError(undefined)).toBeNull()
    expect(pgError('text')).toBeNull()
  })
})
