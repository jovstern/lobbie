import { getTranslations } from 'next-intl/server'
import BuildingPageHeader from '@/app/ui/building/building-page-header'
import { DirectorySkeleton } from '@/app/ui/skeletons'

// The header is static, so the loading state shows it as the page will: nothing shifts.
export default async function DirectoryLoading() {
  const t = await getTranslations('Directory')

  return (
    <div className="flex flex-col gap-6">
      <BuildingPageHeader title={t('title')} lead={t('lead')} />
      <DirectorySkeleton />
    </div>
  )
}
