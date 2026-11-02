import { createNavigation } from 'next-intl/navigation'
import { routing } from '@/i18n/routing'

// Locale-aware versions of Next's navigation APIs: they keep or add the locale prefix.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
