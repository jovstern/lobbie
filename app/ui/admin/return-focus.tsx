'use client'

import { useEffect } from 'react'
import { takeClosed } from '@/app/ui/admin/closed-apartment'

/**
 * Rendered where the open apartment was: on mounting (the panel just closed), moves focus to
 * the closed apartment's link in the grid. An effect: focus lives in the DOM, outside React.
 */
export default function ReturnFocus() {
  useEffect(() => {
    const id = takeClosed()
    if (id) document.querySelector<HTMLElement>(`[data-apartment-link="${id}"]`)?.focus()
  }, [])
  return null
}
