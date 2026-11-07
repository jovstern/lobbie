import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { ExpenseFormState } from '@/app/lib/actions/expenses'
import { maxReceiptBytes } from '@/app/lib/utils/receipt-file'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import ExpenseForm, { type ExpenseAction } from '@/app/ui/admin/expense-form'
import en from '@/messages/en.json'

const copy = en.ExpenseForm

function renderForm(action: ExpenseAction) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{
        ExpenseForm: copy,
        ExpenseCategories: en.ExpenseCategories,
      }}
    >
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Expenses
          </h1>
        }
      >
        <ExpenseForm action={action} today="2026-11-02" firstDay="2025-11-01" />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
}

const pdf = () => new File(['%PDF-1.7'], 'door.pdf', { type: 'application/pdf' })

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(copy.category), 'repairs')
  await user.type(screen.getByLabelText(copy.amount), '1250')
  await user.type(screen.getByLabelText(copy.description), 'Lobby door closer')
  await user.upload(screen.getByLabelText(copy.receipt), pdf())
}

describe('ExpenseForm', () => {
  it('sends every field, says it was added, and empties for the next one', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<ExpenseFormState> => ({
      message: null,
      recorded: { description: 'Lobby door closer', amountAgorot: 125_000 },
    }))
    renderForm(action)
    expect(screen.getByLabelText(copy.spentOn)).toHaveValue('2026-11-02')

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: copy.submit }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/^Added: Lobby door closer, ₪\s?1,250$/),
    )
    const sent = action.mock.calls[0] as unknown as [ExpenseFormState, FormData]
    expect(Object.fromEntries(sent[1])).toMatchObject({
      category: 'repairs',
      amount: '1250',
      spentOn: '2026-11-02',
      description: 'Lobby door closer',
    })
    // The file itself: jsdom's FormData leaves out a file set by `upload` (e2e sends a real one).
    await waitFor(() => expect(screen.getByLabelText(copy.description)).toHaveValue(''))
    expect(screen.getByLabelText(copy.category)).toHaveValue('')
  })

  it('keeps what was typed after a refusal, moves focus to the first error, and asks for the file again', async () => {
    const user = userEvent.setup()
    const refused: ExpenseFormState = {
      values: {
        category: 'repairs',
        amount: '0',
        spentOn: '2026-11-02',
        description: 'Lobby door closer',
        receiptName: 'door.pdf',
      },
      errors: { amount: [en.ExpenseErrors.amount] },
      message: null,
    }
    renderForm(vi.fn(async () => refused))

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: copy.submit }))

    const amount = screen.getByLabelText(copy.amount)
    await waitFor(() => expect(amount).toHaveFocus())
    expect(amount).toHaveValue('0')
    expect(amount).toHaveAccessibleDescription(`${copy.amountHint} ${en.ExpenseErrors.amount}`)
    expect(screen.getByLabelText(copy.category)).toHaveValue('repairs')
    expect(screen.getByLabelText(copy.description)).toHaveValue('Lobby door closer')
    expect(screen.getByLabelText(copy.receipt)).toHaveAccessibleDescription(
      `${copy.receiptHint} Choose door.pdf again: a file isn’t kept after an error.`,
    )
  })

  it('refuses a file over 4 MB as soon as it is chosen', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn(async (): Promise<ExpenseFormState> => ({})))
    const receipt = screen.getByLabelText<HTMLInputElement>(copy.receipt)

    await user.upload(
      receipt,
      new File([new Uint8Array(maxReceiptBytes + 1)], 'huge.pdf', { type: 'application/pdf' }),
    )

    expect(receipt).toHaveAccessibleDescription(`${copy.receiptHint} ${copy.receiptTooLarge}`)
    expect(receipt).toBeInvalid()
    expect(receipt.files).toHaveLength(0)
  })
})
