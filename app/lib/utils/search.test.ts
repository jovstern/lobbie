import { describe, expect, it } from 'vitest'
import { searchTerm } from './search'

describe('searchTerm', () => {
  it('is null for nothing, or only spaces', () => {
    expect(searchTerm(undefined)).toBeNull()
    expect(searchTerm('   ')).toBeNull()
  })

  it('trims the text and makes a contains pattern', () => {
    expect(searchTerm('  Ana ')).toEqual({ text: 'Ana', contains: '%Ana%' })
  })

  it('takes LIKE wildcards and the escape character literally', () => {
    expect(searchTerm('50%_a\\b')?.contains).toBe('%50\\%\\_a\\\\b%')
  })

  it('cuts a very long search to 100 characters', () => {
    expect(searchTerm('x'.repeat(150))?.text).toHaveLength(100)
  })
})
