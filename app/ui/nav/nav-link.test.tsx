import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NavLink from '@/app/ui/nav/nav-link'

// next-intl's navigation cannot load in Vitest (it imports `next/navigation` without an
// extension), so a plain anchor stands in; locale prefixes are covered by the e2e tests.
const navigation = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => navigation.pathname,
  Link: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

function renderLinks() {
  render(
    <>
      <NavLink href="/" icon={<span>home-outline</span>} activeIcon={<span>home-solid</span>}>
        Home
      </NavLink>
      <NavLink
        href="/more"
        sections={['/more', '/profile']}
        icon={<span>more-outline</span>}
        activeIcon={<span>more-solid</span>}
      >
        More
      </NavLink>
    </>,
  )
  return {
    home: screen.getByRole('link', { name: /Home/ }),
    more: screen.getByRole('link', { name: /More/ }),
  }
}

describe('NavLink', () => {
  beforeEach(() => {
    navigation.pathname = '/'
  })

  it('marks Home as the current page on /, with its solid icon', () => {
    const { home, more } = renderLinks()

    expect(home).toHaveAttribute('aria-current', 'page')
    expect(home).toHaveTextContent('home-solid')
    expect(more).not.toHaveAttribute('aria-current')
    expect(more).toHaveTextContent('more-outline')
  })

  it('marks an item current on a page that belongs to its section', () => {
    navigation.pathname = '/profile'
    const { home, more } = renderLinks()

    expect(more).toHaveAttribute('aria-current', 'page')
    expect(more).toHaveTextContent('more-solid')
    expect(home).not.toHaveAttribute('aria-current')
  })

  it('marks an item current on a page nested under it', () => {
    navigation.pathname = '/more/anything'
    const { more } = renderLinks()

    expect(more).toHaveAttribute('aria-current', 'page')
  })

  it('does not treat a path that only starts with the same letters as the section', () => {
    navigation.pathname = '/moreover'
    const { home, more } = renderLinks()

    expect(more).not.toHaveAttribute('aria-current')
    expect(home).not.toHaveAttribute('aria-current')
  })
})
