import { requireMember } from '@/app/lib/authz'

/**
 * Sends someone signed in without a building to /join (and someone signed out to sign-in)
 * from a page that is otherwise static. It renders nothing; inside `<Suspense
 * fallback={null}>` the rest of the page stays in the static shell.
 */
export default async function MemberGate() {
  await requireMember()
  return null
}
