'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import type { CreatedInvite } from '@/app/lib/definitions'

/** The links "Invite every apartment" just made, with how many apartments it skipped. */
export type CreatedInvites = { created: CreatedInvite[]; skipped: number }

type CreatedInvitesState = {
  list: CreatedInvites | null
  show: (list: CreatedInvites) => void
  /** The admin has copied them: forget them. */
  dismiss: () => void
}

const CreatedInvitesContext = createContext<CreatedInvitesState | null>(null)

/** The links of the apartments section; it must sit inside `<CreatedInvitesProvider>`. */
export function useCreatedInvites(): CreatedInvitesState {
  const state = use(CreatedInvitesContext)
  if (!state) throw new Error('useCreatedInvites must be used inside <CreatedInvitesProvider>')
  return state
}

/**
 * Keeps the links "Invite every apartment" made until the admin says they copied them, while
 * they move between the apartments pages (the section's layout holds this). The links are
 * shown only once: they live in memory alone, never in storage or the URL, and a reload or
 * leaving the section drops them.
 */
export default function CreatedInvitesProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<CreatedInvites | null>(null)

  return (
    <CreatedInvitesContext value={{ list, show: setList, dismiss: () => setList(null) }}>
      {children}
    </CreatedInvitesContext>
  )
}
