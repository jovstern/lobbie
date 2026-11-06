'use client'

import clsx from 'clsx'
import { useLinkStatus } from 'next/link'

/**
 * A small dot that pulses while its link's page is on the way: feedback for a tap when the
 * page was not prefetched. Always rendered and positioned by the link, so it never shifts the
 * layout; the page itself announces its arrival, so screen readers skip the dot.
 */
export default function LinkPending({ className }: { className: string }) {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden
      className={clsx(
        'bg-accent pointer-events-none absolute size-1.5 rounded-full transition-opacity',
        pending ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0',
        className,
      )}
    />
  )
}
