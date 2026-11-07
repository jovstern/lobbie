import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { ApartmentSummary } from '@/app/lib/definitions'
import StatusSummary, { type ApartmentStatusRow } from '@/app/ui/home/status-summary'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

const catalogs = { he, en }
const fee = 35_000
const month = '2026-11'
const due = { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee } as const
const paid = { kind: 'paid', dueAgorot: fee, paidAgorot: fee } as const

function row(number: string, summary: ApartmentSummary): ApartmentStatusRow {
  return { id: `apt-${number}`, status: { number, ...summary } }
}

function renderSummary(apartments: ApartmentStatusRow[], locale: 'he' | 'en' = 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={{ StatusCard: catalogs[locale].StatusCard }}>
      <StatusSummary month={month} apartments={apartments} />
    </NextIntlClientProvider>,
  )
  return screen.getByRole('region', { name: catalogs[locale].StatusCard.title })
}

describe('StatusSummary, one apartment', () => {
  it('paid: the word, and the month it covers', () => {
    const card = renderSummary([row('3', { current: paid, monthsBehind: 0, totalOwedAgorot: 0 })])

    expect(within(card).getByText('Paid')).toBeVisible()
    expect(card).toHaveTextContent("You're paid up for November 2026")
  })

  it('due: the amount remaining for the month', () => {
    const card = renderSummary([row('3', { current: due, monthsBehind: 0, totalOwedAgorot: fee })])

    expect(within(card).getByText('Due')).toBeVisible()
    expect(card).toHaveTextContent('₪350')
    expect(card).toHaveTextContent('Due for November 2026')
  })

  it('due after a partial payment: what is left', () => {
    const card = renderSummary([
      row('3', {
        current: { ...due, paidAgorot: 20_000, remainingAgorot: 15_000 },
        monthsBehind: 0,
        totalOwedAgorot: 15_000,
      }),
    ])

    expect(card).toHaveTextContent('₪150')
    expect(card).toHaveTextContent('Left to pay for November 2026')
  })

  it('overdue: the total owed, then what is overdue and what is due this month apart', () => {
    const card = renderSummary([
      row('9', { current: due, monthsBehind: 2, totalOwedAgorot: 3 * fee }),
    ])

    expect(within(card).getByText('Overdue')).toBeVisible()
    expect(card).toHaveTextContent('₪1,050')
    expect(card).toHaveTextContent('Total owed')
    // The count of months goes with the overdue amount, never with the whole.
    expect(card).toHaveTextContent('₪700 overdue (2 months) + ₪350 due this month')
  })

  it('overdue in Hebrew, with the dual form', () => {
    const card = renderSummary(
      [row('9', { current: due, monthsBehind: 2, totalOwedAgorot: 3 * fee })],
      'he',
    )

    expect(within(card).getByText('בפיגור')).toBeVisible()
    expect(card).toHaveTextContent('בפיגור (חודשיים) + ')
  })

  it('no fee: explains there is nothing to pay', () => {
    const card = renderSummary([
      row('3', { current: { kind: 'no-fee' }, monthsBehind: 0, totalOwedAgorot: 0 }),
    ])

    expect(within(card).getByText('No fee')).toBeVisible()
    expect(card).toHaveTextContent(
      "The committee hasn't set a fee for November 2026, so there's nothing to pay.",
    )
  })

  it('not billed: an empty state', () => {
    const card = renderSummary([
      row('3', { current: { kind: 'not-billed' }, monthsBehind: 0, totalOwedAgorot: 0 }),
    ])

    expect(within(card).getByText("Billing hasn't started yet")).toBeVisible()
    expect(card).toHaveTextContent(
      "Once the committee starts billing, you'll see here whether you're paid up.",
    )
  })

  it('no apartment: says whom to ask', () => {
    const card = renderSummary([])

    expect(card).toHaveTextContent("You're not linked to an apartment yet")
    expect(card).toHaveTextContent('Ask your building committee to add you to your apartment.')
  })
})

describe('StatusSummary, several apartments', () => {
  it('shows one row per apartment, labelled by its number', () => {
    const card = renderSummary([
      row('3', { current: paid, monthsBehind: 0, totalOwedAgorot: 0 }),
      row('7', { current: due, monthsBehind: 0, totalOwedAgorot: fee }),
      row('9', { current: due, monthsBehind: 1, totalOwedAgorot: 2 * fee }),
      row('12', { current: { kind: 'not-billed' }, monthsBehind: 0, totalOwedAgorot: 0 }),
    ])

    const rows = within(card).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('Apartment 3')
    expect(rows[0]).toHaveTextContent('Paid')
    expect(rows[0]).toHaveTextContent('Paid for November 2026')
    expect(rows[1]).toHaveTextContent('Apartment 7')
    expect(rows[1]).toHaveTextContent('₪350 to pay')
    expect(rows[2]).toHaveTextContent('Apartment 9')
    expect(rows[2]).toHaveTextContent('Overdue')
    expect(rows[2]).toHaveTextContent('₪350 overdue (1 month) + ₪350 due this month')
    expect(rows[3]).toHaveTextContent('Apartment 12')
    expect(rows[3]).toHaveTextContent('Not billed yet')
  })

  it('behind with this month paid: only what is overdue', () => {
    const card = renderSummary([
      row('3', { current: paid, monthsBehind: 0, totalOwedAgorot: 0 }),
      row('9', { current: paid, monthsBehind: 1, totalOwedAgorot: fee }),
    ])

    const rows = within(card).getAllByRole('listitem')
    expect(rows[1]).toHaveTextContent(/₪350 overdue \(1 month\)$/)
  })
})
