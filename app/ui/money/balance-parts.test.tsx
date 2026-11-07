import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import CategoryBars from '@/app/ui/money/category-bars'
import FundCard from '@/app/ui/money/fund-card'
import en from '@/messages/en.json'

function renderEn(children: ReactNode) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ Balance: en.Balance, ExpenseCategories: en.ExpenseCategories }}
    >
      {children}
    </NextIntlClientProvider>,
  )
}

const opening = { openingBalanceAgorot: 850_000, adjustmentsAgorot: 0 }

describe('FundCard', () => {
  it('with only the opening balance, says so instead of listing empty parts', () => {
    renderEn(
      <FundCard
        fund={{ ...opening, paymentsAgorot: 0, expensesAgorot: 0, totalAgorot: 850_000 }}
      />,
    )
    const card = screen.getByRole('region', { name: en.Balance.nowTitle })

    expect(card).toHaveTextContent('₪8,500')
    expect(card).toHaveTextContent(en.Balance.openingOnly)
    expect(within(card).queryByRole('term')).toBeNull()
  })

  it('shows how the balance is made: opening, payments in, adjustments, expenses out', () => {
    renderEn(
      <FundCard
        fund={{
          openingBalanceAgorot: 850_000,
          adjustmentsAgorot: -5_000,
          paymentsAgorot: 420_000,
          expensesAgorot: 300_000,
          totalAgorot: 965_000,
        }}
      />,
    )
    const card = screen.getByRole('region', { name: en.Balance.nowTitle })

    expect(card).toHaveTextContent('₪9,650')
    expect(within(card).getAllByRole('term')).toHaveLength(4)
    expect(card).toHaveTextContent('+₪4,200')
    expect(card).toHaveTextContent('-₪50')
    expect(card).toHaveTextContent('-₪3,000')
    expect(card).not.toHaveTextContent(en.Balance.openingOnly)
  })
})

describe('CategoryBars', () => {
  it('gives each category its amount and share as text; the bars are hidden from readers', () => {
    renderEn(
      <CategoryBars
        expensesAgorot={25_000}
        categories={[
          { category: 'cleaning', amountAgorot: 20_000 },
          { category: 'water', amountAgorot: 5_000 },
        ]}
      />,
    )
    const items = within(
      screen.getByRole('list', { name: en.Balance.categoriesTitle }),
    ).getAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Cleaning')
    expect(items[0]).toHaveTextContent('₪200')
    expect(items[0]).toHaveTextContent('80% of expenses')
    expect(items[1]).toHaveTextContent('Water')
    expect(items[1]).toHaveTextContent('20% of expenses')
  })

  it('shows nothing in a year without expenses: the expenses card says so, once', () => {
    renderEn(<CategoryBars expensesAgorot={0} categories={[]} />)

    expect(screen.queryByText(en.Balance.categoriesTitle)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
