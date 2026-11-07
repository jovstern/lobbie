// The apartment just closed on `/admin/payments`, for the grid to give its link the focus once
// the panel is gone. A module variable, not state: it crosses one navigation and is read once.
let closed: string | null = null

/** Called by the × as it closes the apartment. */
export function rememberClosed(apartmentId: string) {
  closed = apartmentId
}

/** The apartment just closed, once; null after. */
export function takeClosed(): string | null {
  const apartmentId = closed
  closed = null
  return apartmentId
}
