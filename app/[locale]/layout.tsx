import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { dirFor } from '@/i18n/locale'
import { routing } from '@/i18n/routing'
import { rubik } from '@/app/ui/fonts'
import '@/app/globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return {
    title: { template: `%s | ${t('appName')}`, default: t('appName') },
    description: t('description'),
  }
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  // Validated in i18n/request.ts: an unknown locale is a 404.
  const locale = await getLocale()
  const messages = await getMessages()
  // Imported only in development: the condition is fixed at build time, so production
  // bundles never reference the module (next/web-vitals is CommonJS and would not shake out).
  const WebVitals =
    process.env.NODE_ENV === 'development' ? (await import('@/app/ui/web-vitals')).default : null

  return (
    <html lang={locale} dir={dirFor(locale)} className={rubik.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {WebVitals ? <WebVitals /> : null}
        {/* Only the namespaces client components read; each new one is added here. */}
        <NextIntlClientProvider
          messages={{
            AdjustmentForm: messages.AdjustmentForm,
            ApartmentForm: messages.ApartmentForm,
            ApartmentRemove: messages.ApartmentRemove,
            BuildingForm: messages.BuildingForm,
            Common: messages.Common,
            CopyButton: messages.CopyButton,
            ErrorPage: messages.ErrorPage,
            InviteAdmin: messages.InviteAdmin,
            InviteAll: messages.InviteAll,
            JoinCodeForm: messages.JoinCodeForm,
            LanguageSwitch: messages.LanguageSwitch,
            PersonRemove: messages.PersonRemove,
            PersonRole: messages.PersonRole,
            Residents: messages.Residents,
            Roles: messages.Roles,
            Search: messages.Search,
            SignInForm: messages.SignInForm,
          }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
