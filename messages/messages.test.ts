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

// In a right-to-left sentence, punctuation right after Latin text (or an inserted address)
// is drawn on the far side of it, so "name@example.com." shows as ".name@example.com".
// Hebrew messages keep Latin text away from punctuation instead.
describe('Hebrew messages with Latin text', () => {
  // ICU arguments ({count, plural, …}) are code, not text: removed innermost first.
  function withoutArguments(message: string): string {
    const stripped = message.replace(/\{[^{}]*\}/g, '')
    return stripped === message ? message : withoutArguments(stripped)
  }

  it('never end Latin text or a tagged value with punctuation', () => {
    const latinThenPunctuation = /([A-Za-z0-9]|<\/[a-z]+>)[.,:;!?)](\s|$)/
    const offending = leaves(he)
      .map(({ key, value }) => ({ key, text: withoutArguments(String(value)) }))
      .filter(({ text }) => latinThenPunctuation.test(text))
      .map(({ key }) => key)
    expect(offending).toEqual([])
  })
})
