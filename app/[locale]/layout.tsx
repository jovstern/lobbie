import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { dirFor } from '@/i18n/locale'
import { routing } from '@/i18n/routing'
import { pickMessages, sharedNamespaces } from '@/app/ui/client-messages'
import { rubik } from '@/app/ui/fonts'
import WebVitals from '@/app/ui/web-vitals'
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

  return (
    <html lang={locale} dir={dirFor(locale)} className={rubik.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {/* Logs in development only (see web-vitals.tsx). */}
        <WebVitals />
        {/* Only the namespaces client components read on any page; each admin page adds its
            own (ClientMessages). */}
        <NextIntlClientProvider messages={pickMessages(messages, sharedNamespaces)}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
