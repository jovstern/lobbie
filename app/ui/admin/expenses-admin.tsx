import { getLocale, getTranslations } from 'next-intl/server'
import { record } from '@/app/lib/actions/expenses'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/expenses'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import ExpenseForm from '@/app/ui/admin/expense-form'
import ExpenseList from '@/app/ui/admin/expense-list'
import { cardClassName } from '@/app/ui/card'
import { moneyFont } from '@/app/ui/money-font'

/** The page's heading, which takes focus when the button a dialog opened from is gone. */
const headingId = 'expenses-title'

/**
 * `/admin/expenses` for the committee and up (R18): adding an expense with its receipt, on the
 * page (a long form, spec §6), then every expense, newest first, each voidable.
 */
export default async function ExpensesAdmin() {
  // The committee and up; anyone else gets the 404, before anything of the building is read.
  const { timeZone } = await requireRole('committee')
  const [{ expenses, today, firstDay }, t, locale] = await Promise.all([
    list(),
    getTranslations('AdminExpenses'),
    getLocale(),
  ])

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <AdminAnnouncer
      headingId={headingId}
      header={<AdminPageHeader title={t('title')} lead={t('lead')} headingId={headingId} />}
    >
      <section aria-labelledby="expense-form-title" className={`${cardClassName} max-w-3xl`}>
        <h2 id="expense-form-title" className="text-lg font-semibold">
          {t('formTitle')}
        </h2>
        <ExpenseForm action={record.bind(null, locale)} today={today} firstDay={firstDay} />
      </section>
      {/* Amounts: the font instance that preloads ₪'s file. */}
      <section
        aria-labelledby="expenses-list-title"
        className={`${moneyFont.className} ${cardClassName}`}
      >
        <h2 id="expenses-list-title" className="text-lg font-semibold">
          {t('listTitle')}
        </h2>
        <ExpenseList expenses={expenses} timeZone={timeZone} />
      </section>
    </AdminAnnouncer>
  )
}
