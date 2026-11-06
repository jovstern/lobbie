import { getLocale } from 'next-intl/server'
import { removeFromBuilding, setRole } from '@/app/lib/actions/members'
import type { Person } from '@/app/lib/definitions'
import { displayName } from '@/app/lib/utils/display-name'
import PersonRoleDialog from '@/app/ui/admin/person-role-dialog'
import RemovePersonDialog from '@/app/ui/admin/remove-person-dialog'

/** A person's "Change role" and "Remove", the server's own guards behind each. */
type Props = {
  person: Person
  /** Whether this is the signed-in admin, whom both dialogs warn. */
  isSelf: boolean
}

export default async function PersonActions({ person, isSelf }: Props) {
  const locale = await getLocale()
  const name = displayName(person)

  return (
    <div className="flex flex-wrap items-start gap-2">
      <PersonRoleDialog
        action={setRole.bind(null, locale, person.userId)}
        name={name}
        isSelf={isSelf}
        saved={{ role: person.role, committeeTitle: person.committeeTitle ?? '' }}
      />
      <RemovePersonDialog
        action={removeFromBuilding.bind(null, locale, person.userId)}
        name={name}
        isSelf={isSelf}
      />
    </div>
  )
}
