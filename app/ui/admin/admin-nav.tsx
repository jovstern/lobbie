import { getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import AdminNavLink from '@/app/ui/admin/admin-nav-link'
import { adminSections } from '@/app/ui/admin/admin-sections'

/**
 * The admin sections the member may open. This only hides links: each page checks the role
 * itself, because a layout does not run again on client navigation.
 */
export default async function AdminNav() {
  const [{ role }, t] = await Promise.all([requireMember(), getTranslations('Admin')])
  const sections = adminSections.filter((section) => hasRole(role, section.minRole))
  // One link would only point at the page already open.
  if (sections.length < 2) return null

  return (
    // On a phone the last tab may not fit: its end fades, so a cut-off "People" reads as more to
    // scroll to, and the padding lets it scroll clear of the fade.
    <nav
      aria-label={t('navLabel')}
      className="border-border overflow-x-auto border-b max-sm:ltr:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] max-sm:rtl:[mask-image:linear-gradient(to_left,black_calc(100%-2rem),transparent)]"
    >
      <ul className="flex gap-6 max-sm:pe-8">
        {sections.map((section) => (
          <li key={section.href}>
            <AdminNavLink href={section.href}>{t(section.label)}</AdminNavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
