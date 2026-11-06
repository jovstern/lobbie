/** The longest search the lists take: anything longer is cut, never an error. */
const maxLength = 100

export type SearchTerm = {
  /** As typed, trimmed. */
  text: string
  /** A LIKE pattern for text containing it, with `%`, `_` and `\` taken literally. */
  contains: string
}

/** A `?q=` search as a query uses it, or null when there is nothing to search for. */
export function searchTerm(q: string | undefined): SearchTerm | null {
  const text = (q ?? '').trim().slice(0, maxLength)
  if (!text) return null
  return { text, contains: `%${text.replace(/[\\%_]/g, '\\$&')}%` }
}
