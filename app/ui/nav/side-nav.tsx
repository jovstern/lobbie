import { HomeIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import NavLink from '@/app/ui/nav/nav-link'
import { navItems } from '@/app/ui/nav/nav-items'
import SideNavAdmin from '@/app/ui/nav/side-nav-admin'

/** From 1024 px: the navigation runs down the inline-start edge, under the app's name. */
export default async function SideNav() {
  const [t, tMeta] = await Promise.all([getTranslations('Nav'), getTranslations('Metadata')])

  return (
    <nav
      aria-label={t('label')}
      data-testid="side-nav"
      className="border-border bg-surface-raised sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-e p-4 lg:flex"
    >
      <p className="text-accent flex items-center gap-2 px-3 pt-2 text-lg font-semibold">
        <HomeIcon aria-hidden className="size-6" />
        {tMeta('appName')}
      </p>
      <ul className="flex flex-col gap-1">
        {navItems.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              sections={item.sections}
              icon={item.icon}
              activeIcon={item.activeIcon}
            >
              {t(item.label)}
              {item.hiddenLabel ? <span className="sr-only"> {t(item.hiddenLabel)}</span> : null}
            </NavLink>
          </li>
        ))}
      </ul>
      {/* Role-dependent, so it streams in and the rest of the shell stays static. */}
      <Suspense fallback={null}>
        <SideNavAdmin />
      </Suspense>
    </nav>
  )
}
