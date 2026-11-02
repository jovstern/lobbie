import type { Locale } from '@/i18n/routing'
import type messages from '@/messages/he.json'

// Types every next-intl API: locales are 'he' | 'en' and message keys are checked.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
