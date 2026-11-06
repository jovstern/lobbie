'use client'

import { lazy, type ComponentProps } from 'react'

const CommitteeContactForm = lazy(() => import('@/app/ui/profile/committee-contact-form'))

/**
 * `CommitteeContactForm`, split from Profile's bundle: only committee members see it, so a
 * resident's Profile never loads its code. It still renders on the server, so nothing shifts;
 * the page's own Suspense boundary covers the load on a client-side navigation. A function, not
 * the lazy component itself: a Server Component can only render a client module's functions.
 */
export default function CommitteeContact(props: ComponentProps<typeof CommitteeContactForm>) {
  return <CommitteeContactForm {...props} />
}
