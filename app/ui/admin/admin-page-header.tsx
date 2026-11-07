import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  lead: string
  /** For a page whose dialogs move focus to the heading when the button that had it is gone. */
  headingId?: string
}

/**
 * An admin page's title and lead. Neither depends on data, so pages render this outside their
 * Suspense boundary, in the static shell: it paints first, before the role check and the data
 * stream in. Below the role the page still answers with the not-found page, which replaces it.
 */
export default function AdminPageHeader({ title, lead, headingId }: Props) {
  return (
    <header className="flex flex-col gap-2">
      {/* Focusable from script only, when it is the dialogs' fallback target. */}
      <h1
        id={headingId}
        tabIndex={headingId ? -1 : undefined}
        className="text-2xl font-semibold text-balance focus:outline-none"
      >
        {title}
      </h1>
      <p className="text-text-muted max-w-prose text-pretty">{lead}</p>
    </header>
  )
}
