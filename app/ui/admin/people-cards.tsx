import { getTranslations } from 'next-intl/server'
import type { Person } from '@/app/lib/definitions'
import ApartmentChips from '@/app/ui/admin/apartment-chips'
import PersonActions from '@/app/ui/admin/person-actions'
import PersonName from '@/app/ui/admin/person-name'
import PersonRole from '@/app/ui/admin/person-role'

type Props = {
  people: Person[]
  /** The signed-in admin, whose card is marked. */
  selfId: string
}

/** The people as cards, on phones; wider screens get `PeopleTable`. */
export default async function PeopleCards({ people, selfId }: Props) {
  const t = await getTranslations('People')

  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {people.map((person) => (
        <li
          key={person.userId}
          className="rounded-card border-border bg-surface-raised shadow-card flex flex-col gap-3 border p-4"
        >
          <PersonName person={person} isSelf={person.userId === selfId} asHeading />
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-text-muted text-sm">{t('apartments')}</dt>
              <dd>
                <ApartmentChips apartments={person.apartments} />
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-text-muted text-sm">{t('role')}</dt>
              <dd>
                <PersonRole person={person} />
              </dd>
            </div>
          </dl>
          <PersonActions person={person} isSelf={person.userId === selfId} />
        </li>
      ))}
    </ul>
  )
}
