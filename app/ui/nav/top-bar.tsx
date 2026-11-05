import { Suspense } from 'react'
import BuildingName from '@/app/ui/nav/building-name'
import LanguageSwitch from '@/app/ui/nav/language-switch'
import LanguageSwitchLink from '@/app/ui/nav/language-switch-link'
import { BuildingNameSkeleton } from '@/app/ui/skeletons'

export default function TopBar() {
  return (
    <header className="border-border bg-surface-raised border-b pt-[env(safe-area-inset-top)] lg:bg-transparent">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
        <Suspense fallback={<BuildingNameSkeleton />}>
          <BuildingName />
        </Suspense>
        <Suspense fallback={<LanguageSwitchLink />}>
          <LanguageSwitch />
        </Suspense>
      </div>
    </header>
  )
}
