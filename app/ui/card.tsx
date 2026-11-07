import clsx from 'clsx'
import type { ReactNode } from 'react'

/** The raised surface of every card, also used by the skeletons. */
export const cardClassName =
  'rounded-card border-border bg-surface-raised shadow-card flex flex-col gap-4 border p-6'

/**
 * Each Home card's least height, shared with its skeleton so nothing shifts when it streams
 * in. On desktop the two sit in one grid row, so they share the taller one.
 */
export const homeCardHeights = { status: 'min-h-64', balance: 'min-h-52 lg:min-h-64' } as const

type Props = {
  /** Unique on the page: the card is a region named by its title. */
  titleId: string
  title: string
  /** A least height, such as one of `homeCardHeights`. */
  minHeight?: string
  /**
   * Quiet on Home, where the figures inside lead; a section's heading on the Money pages, as
   * their other sections have.
   */
  heading?: 'quiet' | 'section'
  children: ReactNode
}

export default function Card({ titleId, title, minHeight, heading = 'quiet', children }: Props) {
  return (
    <section aria-labelledby={titleId} className={clsx(cardClassName, minHeight)}>
      <h2
        id={titleId}
        className={
          heading === 'quiet' ? 'text-text-muted text-base font-medium' : 'text-lg font-semibold'
        }
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
