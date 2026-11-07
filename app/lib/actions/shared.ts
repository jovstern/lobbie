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

/**
 * The admin pages that show apartments (with their residents and invites), and the payments
 * grid, whose rows are the apartments and whose months owe from each one's billing start.
 */
export function refreshApartmentPages() {
  revalidatePath('/[locale]/admin/apartments', 'page')
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
  revalidatePath('/[locale]/admin/payments', 'page')
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
 * pages whose months owe the fee in force: the committee's payment pages, Home's status card
 * and the residents' Money page.
 */
export function refreshFeePages() {
  revalidatePath('/[locale]/admin/fees', 'page')
  refreshApartmentPages()
  refreshPaymentOverviews()
  revalidatePath('/[locale]', 'page')
  revalidatePath('/[locale]/money', 'page')
}

/**
 * The pages that show the building fund: Home, whose fund card shows the balance, and the
 * balance page, with the year's money in and out. Every write to the fund refreshes them.
 */
export function refreshFundPages() {
  revalidatePath('/[locale]', 'page')
  revalidatePath('/[locale]/money/balance', 'page')
}

/**
 * The pages that show an apartment's payments: its admin page, the arrears overview and the
 * grid, Home, whose status card says whether it is paid up, and the residents' Money page;
 * and the fund the payments go into.
 */
export function refreshPaymentPages() {
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
  refreshPaymentOverviews()
  revalidatePath('/[locale]/money', 'page')
  refreshFundPages()
}

/** The pages that show expenses or the fund they come off: the expenses page and the fund's. */
export function refreshExpensePages() {
  revalidatePath('/[locale]/admin/expenses', 'page')
  refreshFundPages()
}
