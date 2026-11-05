import { getTranslations } from 'next-intl/server'
import type { Person } from '@/app/lib/definitions'

/** A person's role, with their committee title below when they have one. */
export default async function PersonRole({ person }: { person: Person }) {
  const t = await getTranslations('Roles')

  return (
    <span className="flex flex-col">
      <span className="font-medium">{t(person.role)}</span>
      {person.committeeTitle ? (
        <span className="text-text-muted text-sm">{person.committeeTitle}</span>
      ) : null}
    </span>
  )
}
