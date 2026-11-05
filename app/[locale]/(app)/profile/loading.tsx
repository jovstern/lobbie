import { getTranslations } from 'next-intl/server'
import { ProfileSkeleton } from '@/app/ui/skeletons'

// The heading is static, so the loading state shows it as the page will: nothing shifts.
export default async function ProfileLoading() {
  const t = await getTranslations('Profile')

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <ProfileSkeleton />
    </div>
  )
}
