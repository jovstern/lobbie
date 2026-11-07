import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { PaymentFormState } from '@/app/lib/actions/payments'
import type { OpenMonth } from '@/app/lib/definitions'
import PaymentDialog from '@/app/ui/admin/payment-dialog'
import type { PaymentAction } from '@/app/ui/admin/payment-form'
import en from '@/messages/en.json'

const copy = en.PaymentForm
const owing = (month: string, kind: OpenMonth['kind'], paidAgorot = 0): OpenMonth => ({
  month,
  kind,
  dueAgorot: 35_000,
  paidAgorot,
  remainingAgorot: 35_000 - paidAgorot,
})
const months = [
  owing('2026-10', 'overdue', 10_000),
  owing('2026-11', 'due'),
  owing('2026-12', 'upcoming'),
]

function renderDialog(
  action: PaymentAction = vi.fn(async (): Promise<PaymentFormState> => ({})),
  open = months,
) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ PaymentForm: copy, PaymentMethods: en.PaymentMethods, Common: en.Common }}
    >
      <PaymentDialog
        action={action}
        number="4"
        months={open}
        today="2026-11-02"
        lastMonth="2027-11"
      />
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'Apartment 4: record a payment' })
}

const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })

describe('PaymentDialog', () => {
  it('starts with the months owed so far chosen and the amount they owe', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog())
    // The dialog's code loads on first open.
    const dialog = await screen.findByRole('dialog', { name: 'Payment for apartment 4' })

    expect(dialog).toHaveAccessibleDescription(copy.description)
    expect(checkbox(/^October 2026/)).toBeChecked()
    expect(checkbox(/^October 2026/)).toHaveFocus()
    expect(checkbox(/^October 2026/)).toHaveAccessibleName(/Overdue · ₪\s?250 left of ₪\s?350/)
    expect(checkbox(/^November 2026/)).toBeChecked()
    expect(checkbox(/^December 2026/)).not.toBeChecked()
    // ₪250 left of October and ₪350 of November.
    expect(screen.getByLabelText(copy.amount)).toHaveValue('600')
    expect(screen.getByLabelText(copy.paidOn)).toHaveValue('2026-11-02')
  })

  it('fills in what the months owe again when the choice changes', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog())
    await screen.findByRole('dialog')
    const amount = () => screen.getByLabelText(copy.amount)

    await user.click(checkbox(/^December 2026/))
    expect(amount()).toHaveValue('950')
    await user.click(checkbox(/^October 2026/))
    await user.click(checkbox(/^November 2026/))
    expect(amount()).toHaveValue('350')
    await user.click(checkbox(/^December 2026/))
    expect(amount()).toHaveValue('')
  })

  it('sends the months, closes, returns focus to the button and says what was recorded', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<PaymentFormState> => ({
      message: null,
      recorded: { apartmentNumber: '4', amountAgorot: 60_000, months: ['2026-10', '2026-11'] },
    }))
    const trigger = renderDialog(action)

    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.selectOptions(screen.getByLabelText(copy.method), en.PaymentMethods.bit)
    await user.type(screen.getByLabelText(copy.note), 'At the door')
    await user.click(screen.getByRole('button', { name: copy.submit }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Recorded ₪\s?600 for apartment 4 \(2 months\)$/,
    )
    const sent = action.mock.calls[0] as unknown as [PaymentFormState, FormData]
    expect(sent[1].getAll('months')).toEqual(['2026-10', '2026-11'])
    expect(Object.fromEntries([...sent[1]].filter(([name]) => name !== 'months'))).toEqual({
      amount: '600',
      paidOn: '2026-11-02',
      method: 'bit',
      note: 'At the door',
    })
  })

  it('keeps what was sent and focuses the first field with an error', async () => {
    const user = userEvent.setup()
    const failed: PaymentFormState = {
      values: {
        months: ['2026-10', '2026-11'],
        amount: '900',
        paidOn: '2026-11-02',
        method: 'cash',
        note: '',
      },
      errors: { amount: ["That's more than these months owe: ₪600 at most."] },
      message: null,
    }
    await user.click(renderDialog(vi.fn(async () => failed)))
    await screen.findByRole('dialog')
    await user.clear(screen.getByLabelText(copy.amount))
    await user.type(screen.getByLabelText(copy.amount), '900')
    await user.click(screen.getByRole('button', { name: copy.submit }))

    const amount = await screen.findByLabelText(copy.amount)
    await waitFor(() => expect(amount).toHaveFocus())
    expect(amount).toHaveValue('900')
    expect(amount).toHaveAccessibleDescription(
      `${copy.amountHint} That's more than these months owe: ₪600 at most.`,
    )
    expect(checkbox(/^October 2026/)).toBeChecked()
    expect(screen.getByLabelText(copy.method)).toHaveValue('cash')
  })

  it('says there is nothing left to pay when no month is open', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(undefined, []))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Nothing is left to pay, up to and including November 2027.')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
