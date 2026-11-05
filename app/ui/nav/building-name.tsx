import { requireMember } from '@/app/lib/authz'

export default async function BuildingName() {
  const { buildingName } = await requireMember()

  return <p className="truncate text-lg font-semibold">{buildingName}</p>
}
