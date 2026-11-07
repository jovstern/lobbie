import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

/*
 * WCAG 2.5.3 (Label in Name): a control whose accessible name is fuller than its visible text
 * must contain that text, so someone who says what they see ("click Remove") reaches it. Each
 * entry maps such a label (an aria-label) to the visible text of the same control, per
 * namespace; a new aria-label on a visible control belongs here.
 */
const labels = {
  AdminExpenses: { receiptLabel: 'receipt' },
  ApartmentForm: { editLabel: 'edit' },
  ApartmentRemove: { removeLabel: 'remove' },
  InviteAdminClient: { revokeLabel: 'revoke' },
  InviteAll: { copyLinkLabel: 'copyLink' },
  PersonRemove: { removeLabel: 'remove' },
  PersonRole: { editLabel: 'edit' },
  ResidentsClient: { removeLabel: 'remove' },
  Search: { clearLabel: 'clear' },
  VoidExpense: { openLabel: 'open' },
} as const

type Catalog = typeof en

function message(catalog: Catalog, namespace: keyof typeof labels, key: string): string {
  const value: unknown = (catalog[namespace] as Record<string, unknown>)[key]
  if (typeof value !== 'string') throw new Error(`${namespace}.${key} is missing`)
  return value
}

const cases = Object.entries(labels).flatMap(([namespace, pairs]) =>
  Object.entries(pairs).map(([label, visible]) => ({
    namespace: namespace as keyof typeof labels,
    label,
    visible,
  })),
)

describe.each([
  ['en', en],
  ['he', he],
] as const)('labels in %s', (_locale, catalog) => {
  it.each(cases)(
    '$namespace.$label contains $namespace.$visible',
    ({ namespace, label, visible }) => {
      const name = message(catalog, namespace, label).toLocaleLowerCase()
      expect(name).toContain(message(catalog, namespace, visible).toLocaleLowerCase())
    },
  )
})
