import { getLocale, getTranslations } from 'next-intl/server'
import { record } from '@/app/lib/actions/expenses'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/expenses'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import ExpenseForm from '@/app/ui/admin/expense-form'
import ExpenseList from '@/app/ui/admin/expense-list'
import { cardClassName } from '@/app/ui/card'
import YearNav from '@/app/ui/year-nav'

/** The page's heading, which takes focus when the button a dialog opened from is gone. */
const headingId = 'expenses-title'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * `/admin/expenses` for the committee and up (R18): adding an expense with its receipt, on the
 * page (a long form, spec §6), then one year's expenses (`?year=`, this year by default),
 * newest first, each voidable.
 */
export default async function ExpensesAdmin({ searchParams }: Props) {
  // The committee and up; anyone else gets the 404, before anything of the building is read.
  const { timeZone } = await requireRole('committee')
  const { year: requestedYear } = await searchParams
  const [{ expenses, today, firstDay, year, years }, t, locale] = await Promise.all([
    list(requestedYear),
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
      <section aria-labelledby="expenses-list-title" className={cardClassName}>
        {/* The list's own status region and heading: a void is said beside the list, and focus
            lands on its heading once the voided row's button is gone. */}
        <AdminAnnouncer
          headingId="expenses-list-title"
          header={
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2
                id="expenses-list-title"
                tabIndex={-1}
                className="text-lg font-semibold focus:outline-none"
              >
                {t('listTitle', { year: String(year) })}
              </h2>
              <YearNav
                year={year}
                years={years}
                hrefFor={(other) =>
                  `/admin/expenses?${new URLSearchParams({ year: String(other) })}`
                }
                label={t('yearsLabel')}
                previousLabel={(other) => t('previousYear', { year: other })}
                nextLabel={(other) => t('nextYear', { year: other })}
              />
            </div>
          }
        >
          <ExpenseList year={year} expenses={expenses} timeZone={timeZone} />
        </AdminAnnouncer>
      </section>
    </AdminAnnouncer>
  )
}
