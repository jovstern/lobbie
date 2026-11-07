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

/** The committee's payment pages: the arrears overview and the grid, which show amounts owed. */
function refreshPaymentOverviews() {
  revalidatePath('/[locale]/admin', 'page')
  revalidatePath('/[locale]/admin/payments', 'page')
}

/**
 * The pages that show fees: the fees page, the apartment pages with each one's fee, and the
 * payment pages, whose months owe the fee in force.
 */
export function refreshFeePages() {
  revalidatePath('/[locale]/admin/fees', 'page')
  refreshApartmentPages()
  refreshPaymentOverviews()
}

/**
 * The pages that show an apartment's payments: its admin page, the arrears overview and the
 * grid, and Home, whose status card says whether it is paid up.
 */
export function refreshPaymentPages() {
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
  refreshPaymentOverviews()
  revalidatePath('/[locale]', 'page')
}
