import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import AuthCard from '@/app/ui/auth/auth-card'
import JoinInvite from '@/app/ui/join/join-invite'
import { JoinInviteSkeleton } from '@/app/ui/skeletons'

// The code in the URL is a bearer secret: never indexed, never sent on as a referrer (the
// proxy also sets the Referrer-Policy header on /join pages).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Join')
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' }
}

export default async function JoinInvitePage({ params }: PageProps<'/[locale]/join/[code]'>) {
  const t = await getTranslations('JoinInvite')

  return (
    <AuthCard>
      {/* Static, so it paints with the shell; what the invite says streams in below it. */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">{t('pageTitle')}</h1>
        <p className="text-text-muted text-pretty">{t('pageLead')}</p>
      </header>
      {/* Only this part reads the code and the session; the card is the static shell. */}
      <Suspense fallback={<JoinInviteSkeleton />}>
        <JoinInvite params={params} />
      </Suspense>
    </AuthCard>
  )
}
