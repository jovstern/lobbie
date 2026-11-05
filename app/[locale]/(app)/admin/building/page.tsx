import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import BuildingSettings from '@/app/ui/admin/building-settings'
import { BuildingSettingsSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminBuilding')
  return { title: t('title') }
}

// Admins only (★): BuildingSettings checks the role and answers 404 to anyone else.
export default function AdminBuildingPage() {
  return (
    <Suspense fallback={<BuildingSettingsSkeleton />}>
      <BuildingSettings />
    </Suspense>
  )
}
