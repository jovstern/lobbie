import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import MoreLink from '@/app/ui/nav/more-link'

/** On phones the admin section is a row of More, not a sixth tab; committee and up only. */
export default async function MoreAdminLink() {
  const [{ role }, t] = await Promise.all([requireMember(), getTranslations('More')])
  if (!hasRole(role, 'committee')) return null

  return (
    <MoreLink href="/admin" icon={<Cog6ToothIcon />}>
      {t('admin')}
    </MoreLink>
  )
}
