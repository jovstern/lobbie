import { describe, expect, it } from 'vitest'
import { typed } from './form'

describe('typed', () => {
  it('is the text of a field, or empty when it is missing or a file', () => {
    const data = new FormData()
    data.set('name', ' Pomegranate ')
    data.set('receipt', new Blob(['x']))

    expect(typed(data, 'name')).toBe(' Pomegranate ')
    expect(typed(data, 'missing')).toBe('')
    expect(typed(data, 'receipt')).toBe('')
  })
})
