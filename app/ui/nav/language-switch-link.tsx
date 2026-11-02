'use client'

import { LanguageIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

const otherLocale: Record<Locale, Locale> = { he: 'en', en: 'he' }

type Props = {
  /** The page's query, kept across the switch; left out in the static shell. */
  query?: Record<string, string>
}

/**
 * Opens the same page in the other language, named in that language. next-intl's Link saves
 * the choice in the locale cookie on click, so the proxy keeps it on later visits.
 */
export default function LanguageSwitchLink({ query }: Props) {
  const t = useTranslations('LanguageSwitch')
  const pathname = usePathname()
  const target = otherLocale[useLocale()]

  return (
    <Link
      href={query ? { pathname, query } : pathname}
      locale={target}
      className="rounded-control text-text hover:bg-surface active:bg-border inline-flex min-h-11 items-center gap-2 px-3 font-medium transition-colors"
    >
      <LanguageIcon aria-hidden className="text-text-muted size-5" />
      <span lang={target}>{t('otherLanguage')}</span>
    </Link>
  )
}
