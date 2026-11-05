import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import PeopleList from '@/app/ui/admin/people-list'
import SearchField from '@/app/ui/search-field'
import { PeopleListSkeleton } from '@/app/ui/skeletons'

const headingId = 'people-title'

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
      headingId={headingId}
      header={
        <header className="flex flex-col gap-4">
          {/* Focusable from script: it takes focus when the button that had it is gone. */}
          <h1 id={headingId} tabIndex={-1} className="text-2xl font-semibold">
            {t('title')}
          </h1>
          <SearchField query={query} label={t('searchLabel')} hint={t('searchHint')} />
        </header>
      }
    >
      {/* Keyed by the search, so each new one shows the skeleton while it loads. */}
      <Suspense key={query} fallback={<PeopleListSkeleton />}>
        <PeopleList query={query} />
      </Suspense>
    </AdminAnnouncer>
  )
}
