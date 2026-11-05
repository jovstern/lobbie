import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/members'
import PeopleCards from '@/app/ui/admin/people-cards'
import PeopleTable from '@/app/ui/admin/people-table'
import { buttonClassName } from '@/app/ui/button-styles'
import EmptyState from '@/app/ui/empty-state'
import { Link } from '@/i18n/navigation'

/** The people a search finds, or everyone: a table from tablet width, cards on phones. */
export default async function PeopleList({ query }: { query: string }) {
  const [member, people, t] = await Promise.all([
    requireRole('admin'),
    list(query),
    getTranslations('People'),
  ])
  const searching = query.trim() !== ''

  if (people.length === 0 && searching) {
    return (
      // "Clear" is beside the search field, which keeps focus where the typing is.
      <EmptyState
        icon={MagnifyingGlassIcon}
        title={t('noResultsTitle', { q: query.trim() })}
        body={t('noResultsBody')}
      />
    )
  }

  if (people.length === 0) {
    return (
      <EmptyState icon={UsersIcon} title={t('emptyTitle')} body={t('emptyBody')}>
        <Link href="/admin/apartments" className={buttonClassName('primary')}>
          {t('emptyLink')}
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted">{t('count', { count: people.length })}</p>
      <PeopleTable people={people} selfId={member.userId} />
      <PeopleCards people={people} selfId={member.userId} />
    </div>
  )
}
