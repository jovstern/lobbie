import type { Role } from '@/app/lib/definitions'

const rank: Record<Role, number> = { resident: 0, committee: 1, admin: 2 }

/** Whether `role` is at least `min` (resident < committee < admin). */
export function hasRole(role: Role, min: Role): boolean {
  return rank[role] >= rank[min]
}
