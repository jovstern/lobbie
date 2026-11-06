import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { list } from '@/app/lib/data/directory'
import DirectoryFloors from '@/app/ui/building/directory-floors'
import EmptyState from '@/app/ui/empty-state'

/** The residents a search finds, or everyone, by floor. */
export default async function DirectoryList({ query }: { query: string }) {
  const [member, floors, t] = await Promise.all([
    requireMember(),
    list(query),
    getTranslations('Directory'),
  ])

  if (floors.length === 0 && query.trim() !== '') {
    return (
      // "Clear" is beside the search field, which keeps focus where the typing is.
      <EmptyState
        icon={MagnifyingGlassIcon}
        title={t('noResultsTitle', { q: query.trim() })}
        body={t('noResultsBody')}
      />
    )
  }

  if (floors.length === 0) {
    return <EmptyState icon={UsersIcon} title={t('emptyTitle')} body={t('emptyBody')} />
  }

  return <DirectoryFloors floors={floors} myApartmentIds={member.apartmentIds} />
}
