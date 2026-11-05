import { Suspense } from 'react'
import BuildingName from '@/app/ui/nav/building-name'
import LanguageSwitch from '@/app/ui/nav/language-switch'
import LanguageSwitchLink from '@/app/ui/nav/language-switch-link'
import { BuildingNameSkeleton, LanguageSwitchSkeleton } from '@/app/ui/skeletons'

export default function TopBar() {
  return (
    <header className="border-border bg-surface-raised border-b pt-[env(safe-area-inset-top)] lg:bg-transparent">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
        <Suspense fallback={<BuildingNameSkeleton />}>
          <BuildingName />
        </Suspense>
        {/* The link needs the pathname, which a page with a dynamic segment only knows at
            request time; there the outer placeholder stands in until it streams. The inner
            fallback is the static shell's link, without the query. The switch reads the query
            with useSearchParams, which Cache Components render on the server at request time,
            so the link with the query (a search's ?q=) streams in with the same document and
            replaces it before hydration (e2e/directory.spec.ts checks the HTML). */}
        <Suspense fallback={<LanguageSwitchSkeleton />}>
          <Suspense fallback={<LanguageSwitchLink />}>
            <LanguageSwitch />
          </Suspense>
        </Suspense>
      </div>
    </header>
  )
}
