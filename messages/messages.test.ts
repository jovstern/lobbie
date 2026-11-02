import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

type Leaf = { key: string; value: unknown }

function leaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [{ key: prefix, value: node }]
  }
  return Object.entries(node).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  )
}

const catalogs = { he, en }

describe('messages', () => {
  it('has the same keys in Hebrew and English', () => {
    const keys = (catalog: unknown) =>
      leaves(catalog)
        .map((leaf) => leaf.key)
        .sort()
    expect(keys(he)).toEqual(keys(en))
  })

  it.each(Object.entries(catalogs))(
    '%s has a non-empty string for every key',
    (_locale, catalog) => {
      const invalid = leaves(catalog)
        .filter(({ value }) => typeof value !== 'string' || value.trim() === '')
        .map(({ key }) => key)
      expect(invalid).toEqual([])
    },
  )
})
