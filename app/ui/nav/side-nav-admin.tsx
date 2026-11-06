import { Cog6ToothIcon as AdminOutline } from '@heroicons/react/24/outline'
import { Cog6ToothIcon as AdminSolid } from '@heroicons/react/24/solid'
import { getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import NavLink from '@/app/ui/nav/nav-link'

/** The side nav's admin group, for the committee and up; rendered in Suspense by SideNav. */
export default async function SideNavAdmin() {
  const [{ role }, t] = await Promise.all([requireMember(), getTranslations('Nav')])
  if (!hasRole(role, 'committee')) return null

  return (
    <ul className="border-border flex flex-col gap-1 border-t pt-4">
      <li>
        <NavLink href="/admin" icon={<AdminOutline />} activeIcon={<AdminSolid />}>
          {t('admin')}
        </NavLink>
      </li>
    </ul>
  )
}
