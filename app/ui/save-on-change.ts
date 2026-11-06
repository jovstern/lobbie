'use client'

import { useActionState } from 'react'

type Answer = { message?: string | null }

/** A save-on-change action's answer, with a count of its successful saves. */
export type SaveState = Answer & {
  /** Set after a successful save, and new each time, so each "Saved" is announced again. */
  savedId?: number
}

/**
 * `useActionState` for a control that saves as soon as it changes (the save-on-change
 * pattern): it also counts the saves that worked, which `SaveStatus` shows as "Saved".
 */
export function useSaveOnChange(action: (state: Answer, formData: FormData) => Promise<Answer>) {
  const initialState: SaveState = {}
  return useActionState(async (previous: SaveState, formData: FormData): Promise<SaveState> => {
    const next = await action(previous, formData)
    return { ...next, savedId: next.message ? undefined : (previous.savedId ?? 0) + 1 }
  }, initialState)
}
