import 'server-only'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'

// Helpers the Server Actions share. Not a 'use server' module: that may export only async
// functions, and each export would become an endpoint.

/** What a write in a demo building answers instead: the demo is read-only. */
export async function demoRefusal(locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'Demo' })
  return t('readOnly')
}

/** The admin pages that show apartments (with their residents and invites). */
export function refreshApartmentPages() {
  revalidatePath('/[locale]/admin/apartments', 'page')
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
}

/** The admin pages that show people: the people list and the apartment pages. */
export function refreshPeoplePages() {
  revalidatePath('/[locale]/admin/people', 'page')
  refreshApartmentPages()
}
