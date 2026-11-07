'use client'

import { catchError, type ErrorInfo } from 'next/error'
import ArrearsFailed from '@/app/ui/admin/arrears-failed'

/**
 * An error boundary around who is behind on `/admin`, so a failed read there leaves the rest of
 * the overview working. `catchError` lets Next's own signals (a redirect, a 404) through, and
 * its `retry` reads the list again. The server has already logged the error.
 */
export default catchError((props: { title: string; message: string }, { retry }: ErrorInfo) => (
  <ArrearsFailed {...props} retry={retry} />
))
