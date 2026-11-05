import 'server-only'
import { headers } from 'next/headers'
import { cache } from 'react'
import { getAuth } from '@/app/lib/auth'

/** The signed-in session, or null. Read once per request. */
export const getSession = cache(async () => {
  // The request is read first: during prerendering that is where rendering stops, so auth
  // (and its environment variables) is never touched at build time.
  const requestHeaders = await headers()
  return getAuth().api.getSession({ headers: requestHeaders })
})
