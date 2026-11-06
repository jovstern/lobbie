'use client'

import { useSearchParams } from 'next/navigation'
import LanguageSwitchLink from '@/app/ui/nav/language-switch-link'

/**
 * The language switch with the page's query kept. Reading the query suspends while
 * prerendering, so render it in `<Suspense>` with `<LanguageSwitchLink />` as the fallback: the
 * static shell has that, and the server renders this at request time, in the same response.
 */
export default function LanguageSwitch() {
  const searchParams = useSearchParams()

  return <LanguageSwitchLink query={Object.fromEntries(searchParams)} />
}
