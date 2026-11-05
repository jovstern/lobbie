import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import AdminOverview from '@/app/ui/admin/admin-overview'
import { AdminOverviewSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Admin')
  return { title: t('title') }
}

// The arrears overview joins in M3; for now, the way into each admin page.
export default function AdminPage() {
  return (
    <Suspense fallback={<AdminOverviewSkeleton />}>
      <AdminOverview />
    </Suspense>
  )
}
