import type { Role } from '@/app/lib/definitions'

type AdminSection = {
  href: string
  label: 'overview' | 'building' | 'apartments' | 'people' | 'fees'
  /** The lowest role that may open it; anyone below gets a 404 there. */
  minRole: Role
}

// Only pages that exist (spec §6, "Navigation"); each admin page joins as its task lands.
export const adminSections: AdminSection[] = [
  { href: '/admin', label: 'overview', minRole: 'committee' },
  { href: '/admin/building', label: 'building', minRole: 'admin' },
  { href: '/admin/apartments', label: 'apartments', minRole: 'admin' },
  { href: '/admin/people', label: 'people', minRole: 'admin' },
  { href: '/admin/fees', label: 'fees', minRole: 'committee' },
]
