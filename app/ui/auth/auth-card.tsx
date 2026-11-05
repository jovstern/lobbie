import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import AuthCardFrame from '@/app/ui/auth/auth-card-frame'

/** The card the public pages share, in the page's language (see `AuthCardFrame`). */
export default async function AuthCard({ children }: { children: ReactNode }) {
  const t = await getTranslations('Auth')

  return (
    <AuthCardFrame
      appName={t('appName')}
      tagline={t('tagline')}
      panelDescription={t('panelDescription')}
    >
      {children}
    </AuthCardFrame>
  )
}
