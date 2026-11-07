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
            CommitteeContactForm: messages.CommitteeContactForm,
            Common: messages.Common,
            ContactVisibility: messages.ContactVisibility,
            CopyButton: messages.CopyButton,
            ErrorPage: messages.ErrorPage,
            ExpenseCategories: messages.ExpenseCategories,
            ExpenseForm: messages.ExpenseForm,
            FeeForm: messages.FeeForm,
            FollowBuilding: messages.FollowBuilding,
            InviteAdminClient: messages.InviteAdminClient,
            InviteAll: messages.InviteAll,
            JoinCodeForm: messages.JoinCodeForm,
            LanguageChoice: messages.LanguageChoice,
            LanguageSwitch: messages.LanguageSwitch,
            PaymentForm: messages.PaymentForm,
            PaymentMethods: messages.PaymentMethods,
            PersonRemove: messages.PersonRemove,
            PersonRole: messages.PersonRole,
            ProfileForm: messages.ProfileForm,
            ResidentsClient: messages.ResidentsClient,
            Roles: messages.Roles,
            Search: messages.Search,
            SignInForm: messages.SignInForm,
            VoidExpense: messages.VoidExpense,
            VoidPayment: messages.VoidPayment,
          }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
