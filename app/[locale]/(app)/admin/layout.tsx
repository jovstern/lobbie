import { Suspense } from 'react'
import AdminNav from '@/app/ui/admin/admin-nav'
import { AdminNavSkeleton } from '@/app/ui/skeletons'

// The admin section (committee and up). The navigation hides what a role cannot open; every
// page still checks the role itself and answers 404 below it.
export default function AdminLayout({ children }: LayoutProps<'/[locale]/admin'>) {
  return (
    <div className="flex flex-col gap-6">
      {/* The nav's height, so the page below does not drop when it streams in. A committee
          member, with one section, gets no navigation, and the page moves up once instead. */}
      <Suspense fallback={<AdminNavSkeleton />}>
        <AdminNav />
      </Suspense>
      {children}
    </div>
  )
}
