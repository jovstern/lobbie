import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import AdminOverview from '@/app/ui/admin/admin-overview'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import { AdminOverviewSkeleton } from '@/app/ui/skeletons'

// The role first: below it the page is a 404, and its title must not name the page. (The
// status stays 200: with Cache Components the session can only be read inside <Suspense>,
// so the shell has streamed by then, and the status with it.)
export async function generateMetadata(): Promise<Metadata> {
  const [, t] = await Promise.all([requireRole('committee'), getTranslations('Admin')])
  return { title: t('title') }
}

// The arrears overview joins in M3; for now, the way into each admin page.
export default async function AdminPage() {
  const t = await getTranslations('Admin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} lead={t('lead')} />
      <Suspense fallback={<AdminOverviewSkeleton />}>
        <AdminOverview />
      </Suspense>
    </div>
  )
}
