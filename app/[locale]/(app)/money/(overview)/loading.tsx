import MoneyHeader from '@/app/ui/money/money-header'
import { ApartmentMoneySkeleton } from '@/app/ui/skeletons'

// The header is static, so the loading state shows it as the page will: nothing shifts.
export default function MoneyLoading() {
  return (
    <div className="flex flex-col gap-6">
      <MoneyHeader current="apartment" />
      <ApartmentMoneySkeleton />
    </div>
  )
}
