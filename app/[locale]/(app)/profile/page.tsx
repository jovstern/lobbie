import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import ProfileSettings from '@/app/ui/profile/profile-settings'
import { ProfileSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Profile')
  return { title: t('title') }
}

export default async function ProfilePage() {
  const t = await getTranslations('Profile')

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSettings />
      </Suspense>
    </div>
  )
}
