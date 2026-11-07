import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { VoidExpenseState } from '@/app/lib/actions/expenses'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import type { VoidAction } from '@/app/ui/admin/void-dialog-content'
import VoidExpenseDialog from '@/app/ui/admin/void-expense-dialog'
import en from '@/messages/en.json'

const copy = en.VoidExpense

function renderDialog(action: VoidAction, hasReceipt = true) {
  render(
    <NextIntlClientProvider locale="en" messages={{ VoidExpense: copy, Common: en.Common }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Expenses
          </h1>
        }
      >
        <VoidExpenseDialog
          action={action}
          description="Lobby door"
          spentOn="2026-11-01"
          amountAgorot={125_000}
          hasReceipt={hasReceipt}
        />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', {
    name: /^Void the expense Lobby door of 1 Nov 2026, ₪\s?1,250$/,
  })
}

describe('VoidExpenseDialog', () => {
  it('asks why, with focus on the reason', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(vi.fn(async (): Promise<VoidExpenseState> => ({}))))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Void the expense “Lobby door”?',
    })

    expect(dialog).toHaveAccessibleDescription(/goes back into the building fund/)
    expect(screen.getByLabelText(copy.reason)).toHaveFocus()
  })

  it('leaves the receipt out of the confirmation when there is none', async () => {
    const user = userEvent.setup()
    await user.click(
      renderDialog(
        vi.fn(async () => ({})),
        false,
      ),
    )
    const dialog = await screen.findByRole('alertdialog')

    expect(dialog).toHaveAccessibleDescription(/goes back into the building fund/)
    expect(dialog).not.toHaveAccessibleDescription(/receipt/)
  })

  it('keeps the dialog open with a refusal', async () => {
    const user = userEvent.setup()
    const refused: VoidExpenseState = {
      values: { reason: 'Recorded twice' },
      message: en.ExpenseErrors.alreadyVoided,
    }
    await user.click(renderDialog(vi.fn(async () => refused)))
    await screen.findByRole('alertdialog')
    await user.type(screen.getByLabelText(copy.reason), 'Recorded twice')
    await user.click(screen.getByRole('button', { name: copy.confirm }))

    expect(await screen.findByText(en.ExpenseErrors.alreadyVoided)).toBeVisible()
    expect(screen.getByRole('alertdialog')).toBeVisible()
  })

  it('sends the reason, then moves focus to the heading and says it was voided', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<VoidExpenseState> => ({
      message: null,
      voided: { description: 'Lobby door', amountAgorot: 125_000 },
    }))
    await user.click(renderDialog(action))
    await screen.findByRole('alertdialog')
    await user.type(screen.getByLabelText(copy.reason), 'Recorded twice')
    await user.click(screen.getByRole('button', { name: copy.confirm }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Expenses' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      /^The expense Lobby door \(₪\s?1,250\) was voided$/,
    )
    const sent = action.mock.calls[0] as unknown as [VoidExpenseState, FormData]
    expect(sent[1].get('reason')).toBe('Recorded twice')
  })
})
