import { getTranslations } from 'next-intl/server'
import type { Person } from '@/app/lib/definitions'
import ApartmentChips from '@/app/ui/admin/apartment-chips'
import PersonActions from '@/app/ui/admin/person-actions'
import PersonName from '@/app/ui/admin/person-name'
import PersonRole from '@/app/ui/admin/person-role'

type Props = {
  people: Person[]
  /** The signed-in admin, whose row is marked. */
  selfId: string
}

/** The people as a table, from tablet width up; phones get `PeopleCards`. */
export default async function PeopleTable({ people, selfId }: Props) {
  const t = await getTranslations('People')
  const header = 'text-text-muted px-4 py-3 text-start text-sm font-medium'
  const cell = 'px-4 py-3 align-middle'

  return (
    <div className="rounded-card border-border bg-surface-raised shadow-card hidden overflow-x-auto border md:block">
      <table className="w-full border-collapse">
        <caption className="sr-only">{t('tableLabel')}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={header}>
              {t('name')}
            </th>
            <th scope="col" className={header}>
              {t('apartments')}
            </th>
            <th scope="col" className={header}>
              {t('role')}
            </th>
            <th scope="col" className={header}>
              <span className="sr-only">{t('actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {people.map((person) => (
            <tr key={person.userId}>
              <th scope="row" className={`${cell} text-start font-normal`}>
                <PersonName person={person} isSelf={person.userId === selfId} />
              </th>
              <td className={cell}>
                <ApartmentChips apartments={person.apartments} />
              </td>
              <td className={cell}>
                <PersonRole person={person} />
              </td>
              <td className={cell}>
                <PersonActions person={person} isSelf={person.userId === selfId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
