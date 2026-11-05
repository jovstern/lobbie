import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/members'
import PeopleCards from '@/app/ui/admin/people-cards'
import PeopleTable from '@/app/ui/admin/people-table'
import { buttonClassName } from '@/app/ui/button-styles'
import { Link } from '@/i18n/navigation'

const emptyClassName =
  'rounded-card border-border bg-surface-raised flex max-w-xl flex-col items-start gap-3 border p-6'

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
      <div className={emptyClassName}>
        <MagnifyingGlassIcon aria-hidden className="text-text-muted size-8" />
        <h2 className="text-lg font-semibold">{t('noResultsTitle', { q: query.trim() })}</h2>
        {/* "Clear" is beside the search field, which keeps focus where the typing is. */}
        <p className="text-text-muted">{t('noResultsBody')}</p>
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <div className={emptyClassName}>
        <UsersIcon aria-hidden className="text-text-muted size-8" />
        <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
        <p className="text-text-muted">{t('emptyBody')}</p>
        <Link href="/admin/apartments" className={buttonClassName('primary')}>
          {t('emptyLink')}
        </Link>
      </div>
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
