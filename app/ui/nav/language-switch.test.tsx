import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import LanguageSwitch from '@/app/ui/nav/language-switch'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

// next-intl's navigation cannot load in Vitest (it imports `next/navigation` without an
// extension). The stand-in shows the target it was given: next-intl turns it into the
// prefixed URL and saves the cookie, which the e2e tests check.
const navigation = vi.hoisted(() => ({ pathname: '/', search: '' }))
type Href = string | { pathname: string; query: Record<string, string> }
// Formats an href as next-intl would, minus the locale prefix it adds.
const format = (href: Href) => {
  if (typeof href === 'string') return href
  const search = new URLSearchParams(href.query).toString()
  return search ? `${href.pathname}?${search}` : href.pathname
}
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => navigation.pathname,
  Link: ({
    href,
    locale,
    ...props
  }: Omit<ComponentProps<'a'>, 'href'> & { href: Href; locale?: string }) => (
    <a href={format(href)} data-locale={locale} {...props} />
  ),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

const catalogs = { he, en }

function renderSwitch(locale: 'he' | 'en', pathname: string, search = '') {
  navigation.pathname = pathname
  navigation.search = search
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ LanguageSwitch: catalogs[locale].LanguageSwitch }}
    >
      <LanguageSwitch />
    </NextIntlClientProvider>,
  )
}

describe('LanguageSwitch', () => {
  it('on a Hebrew page, opens the same path in English, named in English', () => {
    renderSwitch('he', '/more')

    const link = screen.getByRole('link', { name: 'English' })
    expect(link).toHaveAttribute('href', '/more')
    expect(link).toHaveAttribute('data-locale', 'en')
    expect(screen.getByText('English')).toHaveAttribute('lang', 'en')
  })

  it('on an English page, opens the same path in Hebrew, named in Hebrew', () => {
    renderSwitch('en', '/profile')

    const link = screen.getByRole('link', { name: 'עברית' })
    expect(link).toHaveAttribute('href', '/profile')
    expect(link).toHaveAttribute('data-locale', 'he')
    expect(screen.getByText('עברית')).toHaveAttribute('lang', 'he')
  })

  it('keeps Home as Home', () => {
    renderSwitch('he', '/')

    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/')
  })

  it('keeps the query', () => {
    renderSwitch('he', '/money', '?month=2026-10&apartment=7')

    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
      'href',
      '/money?month=2026-10&apartment=7',
    )
  })
})
