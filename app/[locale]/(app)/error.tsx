'use client'

import ErrorBody from '@/app/ui/error-body'

// Rendered inside the app's shell, so navigation stays. The server has already logged the
// error; this offers a way forward.
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ErrorBody retry={retry} />
    </div>
  )
}
