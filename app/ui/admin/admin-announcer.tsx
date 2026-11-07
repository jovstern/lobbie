'use client'

import { createContext, use, useState, type ReactNode } from 'react'

type Announcer = {
  /** Says what just happened in the page's status region. */
  announce: (message: string) => void
  /** Moves focus to the page heading, for when the button that had it leaves the page. */
  focusHeading: () => void
}

const AnnouncerContext = createContext<Announcer | null>(null)

/** The announcer of the admin page the component is on; it must sit inside one. */
export function useAnnouncer(): Announcer {
  const announcer = use(AnnouncerContext)
  if (!announcer) throw new Error('useAnnouncer must be used inside <AdminAnnouncer>')
  return announcer
}

/** The nearest announcer, or null outside one (a component that can also say things itself). */
export function useMaybeAnnouncer(): Announcer | null {
  return use(AnnouncerContext)
}

type Props = {
  /** The page's `h1`, which takes focus when the button that had it is gone. */
  headingId: string
  /** The page's header; the announcements appear right below it. */
  header: ReactNode
  /** What the page shows below its header. */
  children?: ReactNode
}

/**
 * One status region for an admin page's dialogs (the apartments pages, people). Adding or
 * removing a row changes the list, so the button a dialog opened from may be gone when it
 * closes; the announcement and the focus then need a place that stays. Scoped to each page,
 * not the app; a part of the page (an apartment's payments, the expenses list) may have its
 * own inside, so what happened is said, and focus lands, next to where it happened.
 */
export default function AdminAnnouncer({ headingId, header, children }: Props) {
  // Keyed by a count, so the same message twice is announced twice.
  const [announcement, setAnnouncement] = useState<{ message: string; id: number } | null>(null)

  const announcer: Announcer = {
    announce: (message) =>
      setAnnouncement((previous) => ({ message, id: (previous?.id ?? 0) + 1 })),
    focusHeading: () => document.getElementById(headingId)?.focus(),
  }

  return (
    <AnnouncerContext value={announcer}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {header}
          {/* Always in the page, so screen readers already watch it when a message arrives. */}
          <div role="status" aria-live="polite" aria-atomic="true">
            {announcement ? (
              <p key={announcement.id} className="text-success flex items-center gap-2 font-medium">
                {/* The paid month's mark, from CSS: no icon module in every admin page's bundle. */}
                <span aria-hidden className="status-mark shrink-0" data-status="paid" />
                {announcement.message}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </AnnouncerContext>
  )
}
