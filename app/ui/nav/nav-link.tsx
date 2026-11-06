import { Suspense } from 'react'
import CurrentNavLink from '@/app/ui/nav/current-nav-link'
import NavLinkAnchor, { type NavLinkProps } from '@/app/ui/nav/nav-link-anchor'

/**
 * A navigation item, marked current on its pages. The pathname is not known while
 * prerendering a page with a dynamic segment (`/admin/apartments/[id]`), so there the item
 * renders unmarked in the static shell and is marked as the page streams in; on every other
 * page it is marked in the shell already.
 */
export default function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkAnchor {...props} isCurrent={false} />}>
      <CurrentNavLink {...props} />
    </Suspense>
  )
}
