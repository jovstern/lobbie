import type { ReactNode } from 'react'
import { getMembership } from '@/app/lib/authz'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

type Props = { children: ReactNode; locale: Locale; next: string }

/**
 * /join is for someone signed in without a building: a signed-out visitor goes to sign-in
 * (and back to `next`), and a member goes home.
 */
export default async function JoinGate({ children, locale, next }: Props) {
  const membership = await getMembership()
  if (membership.status === 'signed-out') {
    return redirect({ href: `/sign-in?${new URLSearchParams({ next })}`, locale })
  }
  if (membership.status === 'member') return redirect({ href: '/', locale })
  return children
}
