import { getTranslations } from 'next-intl/server'
import NavLink from '@/app/ui/nav/nav-link'
import { navItems } from '@/app/ui/nav/nav-items'

/** Phones and tablets: the bottom tab bar, clear of the home indicator. */
export default async function TabBar() {
  const t = await getTranslations('Nav')

  return (
    <nav
      aria-label={t('label')}
      data-testid="tab-bar"
      className="border-border bg-surface-raised fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-md items-center justify-around">
        {navItems.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              sections={item.sections}
              icon={item.icon}
              activeIcon={item.activeIcon}
              variant="tab"
            >
              {t(item.label)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
