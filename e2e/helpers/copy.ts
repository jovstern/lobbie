import { createTranslator } from 'next-intl'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

export type Locale = 'he' | 'en'

/** The app's own messages, so tests follow copy changes instead of repeating the strings. */
export const messages = { he, en } as const

/** Formats a message with arguments (plurals, months) as the app does. */
export function translator(locale: Locale) {
  return createTranslator({ locale, messages: messages[locale] })
}
