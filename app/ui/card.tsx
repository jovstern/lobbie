import clsx from 'clsx'
import type { ReactNode } from 'react'

/** The raised surface of every card, also used by the skeletons. */
export const cardClassName =
  'rounded-card border-border bg-surface-raised shadow-card flex flex-col gap-4 border p-6'

/**
 * Each Home card's least height, shared with its skeleton so nothing shifts when it streams
 * in. On desktop the two sit in one grid row, so they share the taller one.
 */
export const homeCardHeights = { status: 'min-h-56', balance: 'min-h-40 lg:min-h-56' } as const

type Props = {
  /** Unique on the page: the card is a region named by its title. */
  titleId: string
  title: string
  /** A least height, such as one of `homeCardHeights`. */
  minHeight?: string
  children: ReactNode
}

export default function Card({ titleId, title, minHeight, children }: Props) {
  return (
    <section aria-labelledby={titleId} className={clsx(cardClassName, minHeight)}>
      <h2 id={titleId} className="text-text-muted text-base font-medium">
        {title}
      </h2>
      {children}
    </section>
  )
}
