'use client'

import ErrorBody from '@/app/ui/error-body'

// Inside the admin layout, so its navigation stays. The server has already logged the error.
export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ErrorBody retry={retry} />
    </div>
  )
}
