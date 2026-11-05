import { ChevronRightIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ComponentType, type SVGProps } from 'react'
import MemberGate from '@/app/ui/member-gate'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('BuildingHub')
  return { title: t('title') }
}

type HubLink = {
  href: string
  label: 'directory' | 'committee'
  body: 'directoryBody' | 'committeeBody'
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Only pages that exist: announcements, parking and cameras join as their milestones land.
const links: HubLink[] = [
  { href: '/building/directory', label: 'directory', body: 'directoryBody', icon: UsersIcon },
  { href: '/building/committee', label: 'committee', body: 'committeeBody', icon: UserGroupIcon },
]

// The same for every member, so it is static; MemberGate sends anyone else away.
export default async function BuildingPage() {
  const t = await getTranslations('BuildingHub')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {/* Members only: the check streams in and renders nothing. */}
      <Suspense fallback={null}>
        <MemberGate />
      </Suspense>
      {/* A list of compact rows on phones; two columns of cards from desktop width. */}
      <ul className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        {links.map(({ href, label, body, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-labelledby={`${label}-link`}
              aria-describedby={`${label}-body`}
              className="rounded-card border-border bg-surface-raised shadow-card hover:border-text-muted active:bg-surface flex h-full items-start gap-3 border p-4 transition-[background-color,border-color] lg:p-6"
            >
              <Icon aria-hidden className="text-accent mt-0.5 size-6 shrink-0" />
              <span className="flex min-w-0 flex-col gap-1">
                <span id={`${label}-link`} className="text-lg font-semibold">
                  {t(label)}
                </span>
                <span id={`${label}-body`} className="text-text-muted text-pretty">
                  {t(body)}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="text-text-muted ms-auto mt-1 size-5 shrink-0 rtl:-scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
