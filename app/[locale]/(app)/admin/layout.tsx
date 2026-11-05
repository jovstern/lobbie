import { Suspense } from 'react'
import AdminNav from '@/app/ui/admin/admin-nav'

// The admin section (committee and up). The navigation hides what a role cannot open; every
// page still checks the role itself and answers 404 below it.
export default function AdminLayout({ children }: LayoutProps<'/[locale]/admin'>) {
  return (
    <div className="flex flex-col gap-6">
      {/* No placeholder: a committee member, with one section, gets no navigation at all. */}
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      {children}
    </div>
  )
}
