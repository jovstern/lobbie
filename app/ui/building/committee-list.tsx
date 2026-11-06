import { UserGroupIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { committee } from '@/app/lib/data/directory'
import ContactLinks from '@/app/ui/building/contact-links'
import EmptyState from '@/app/ui/empty-state'

/** The committee as cards: name, title (or role), and the contact each publishes for it. */
export default async function CommitteeList() {
  const [members, t, tRoles] = await Promise.all([
    committee(),
    getTranslations('Committee'),
    getTranslations('Roles'),
  ])

  if (members.length === 0) {
    return <EmptyState icon={UserGroupIcon} title={t('emptyTitle')} body={t('emptyBody')} />
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => (
        <li
          key={member.userId}
          className="rounded-card border-border bg-surface-raised shadow-card flex flex-col gap-3 border p-4"
        >
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold wrap-anywhere">
              {/* Without a name, the email they publish for the role; never a personal one. */}
              {member.name ??
                (member.committeeEmail ? (
                  <bdi dir="ltr">{member.committeeEmail}</bdi>
                ) : (
                  t('unnamed')
                ))}
            </h2>
            <p className="text-text-muted">{member.committeeTitle ?? tRoles(member.role)}</p>
          </div>
          {member.committeePhone || member.committeeEmail ? (
            <ContactLinks phone={member.committeePhone} email={member.committeeEmail} />
          ) : (
            <p className="text-text-muted text-sm">{t('noContact')}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
