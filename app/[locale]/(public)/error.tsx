'use client'

import ErrorBody from '@/app/ui/error-body'

// The server has already logged the error; this offers a way forward.
export default function PublicError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="rounded-card border-border bg-surface-raised shadow-card flex w-full max-w-md flex-col gap-6 border p-6 sm:p-10">
        <ErrorBody retry={retry} />
      </div>
    </main>
  )
}
