'use client'

import { lazy, Suspense } from 'react'

// The reporter loads only in development: the condition is fixed at build time, so production
// drops the import and `next/web-vitals` (CommonJS, which would not shake out) with it. This
// module itself is a few bytes, imported statically by the root layout: a dynamic import of a
// client component there made dev's prefetch validation fail on every route (the client
// reference proxy had no module factory in that environment).
const Reporter =
  process.env.NODE_ENV === 'development' ? lazy(() => import('@/app/ui/web-vitals-reporter')) : null

/** Web vitals in the console, in development; production reporting arrives with M7. */
export default function WebVitals() {
  if (!Reporter) return null
  return (
    <Suspense fallback={null}>
      <Reporter />
    </Suspense>
  )
}
