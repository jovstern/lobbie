import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import PeopleList from '@/app/ui/admin/people-list'
import SearchField from '@/app/ui/search-field'
import { PeopleListSkeleton } from '@/app/ui/skeletons'

/** The page's heading (in its static header), which takes focus when a dialog's button is gone. */
export const peopleHeadingId = 'people-title'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * `/admin/people` for an admin (R10): everyone in the building, searchable by name or apartment
 * (`?q=`), with their role and committee title, to change or to remove from the building.
 */
export default async function PeopleAdmin({ searchParams }: Props) {
  // Admins only; anyone else gets the 404, before anything of the building is read.
  await requireRole('admin')
  const [{ q }, t] = await Promise.all([searchParams, getTranslations('People')])
  const query = typeof q === 'string' ? q : ''

  return (
    <AdminAnnouncer
      headingId={peopleHeadingId}
      // Below the page's static header.
      header={<SearchField query={query} label={t('searchLabel')} hint={t('searchHint')} />}
    >
      {/* Keyed by the search, so each new one shows the skeleton while it loads. */}
      <Suspense key={query} fallback={<PeopleListSkeleton />}>
        <PeopleList query={query} />
      </Suspense>
    </AdminAnnouncer>
  )
}
