import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireMember } from '@/app/lib/authz'
import DirectoryList from '@/app/ui/building/directory-list'
import SearchField from '@/app/ui/search-field'
import { DirectoryListSkeleton } from '@/app/ui/skeletons'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** The search (`?q=`) and the residents it finds, which reload under it as it changes. */
export default async function DirectoryView({ searchParams }: Props) {
  // A member of a building; anyone else is sent to sign in or to join.
  await requireMember()
  const [{ q }, t] = await Promise.all([searchParams, getTranslations('Directory')])
  const query = typeof q === 'string' ? q : ''

  return (
    <>
      <SearchField query={query} label={t('searchLabel')} hint={t('searchHint')} />
      {/* Keyed by the search, so each new one shows the skeleton while it loads. */}
      <Suspense key={query} fallback={<DirectoryListSkeleton />}>
        <DirectoryList query={query} />
      </Suspense>
    </>
  )
}
