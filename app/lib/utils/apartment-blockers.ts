/** How many rows of each kind still point at an apartment. */
export type BlockerCounts = { residents: number; payments: number; feeOverrides: number }

/** Why an apartment cannot be removed yet, most actionable first. */
export type Blocker = { kind: 'residents'; count: number } | { kind: 'payments' | 'feeOverrides' }

/**
 * What stops an apartment's removal: people still in it (they can be moved), then history the
 * building keeps (payments and fee overrides are never deleted). Empty when it can go.
 */
export function blockersOf(counts: BlockerCounts): Blocker[] {
  const blockers: Blocker[] = []
  if (counts.residents > 0) blockers.push({ kind: 'residents', count: counts.residents })
  if (counts.payments > 0) blockers.push({ kind: 'payments' })
  if (counts.feeOverrides > 0) blockers.push({ kind: 'feeOverrides' })
  return blockers
}

type TranslateBlocker = (key: Blocker['kind'], values?: { count: number }) => string

/** The blockers as sentences, from the `ApartmentBlockers` messages. */
export function describeBlockers(t: TranslateBlocker, blockers: Blocker[]): string {
  return blockers
    .map((blocker) =>
      blocker.kind === 'residents' ? t('residents', { count: blocker.count }) : t(blocker.kind),
    )
    .join(' ')
}
