'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type Props = { id: string; children: ReactNode }

/**
 * The heading of the apartment just opened on `/admin/payments`. It takes focus when one of the
 * page's apartment links opened it (they carry `data-select-apartment`), so a keyboard user
 * lands on its payments rather than staying deep in the grid; a page loaded with the apartment
 * already open keeps the browser's focus. Keyed by the apartment, so each new one runs this
 * once. An effect: focus lives in the DOM, outside React.
 */
export default function ArrivalHeading({ id, children }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (document.activeElement?.closest('[data-select-apartment]')) heading.current?.focus()
  }, [])

  return (
    <h2 ref={heading} id={id} tabIndex={-1} className="text-lg font-semibold">
      {children}
    </h2>
  )
}
