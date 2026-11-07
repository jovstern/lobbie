import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { VoidPaymentState } from '@/app/lib/actions/payments'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import VoidPaymentDialog from '@/app/ui/admin/void-payment-dialog'
import type { VoidPaymentAction } from '@/app/ui/admin/void-payment-dialog-content'
import en from '@/messages/en.json'

const copy = en.VoidPayment

function renderDialog(action: VoidPaymentAction) {
  render(
    <NextIntlClientProvider locale="en" messages={{ VoidPayment: copy, Common: en.Common }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Apartment 4
          </h1>
        }
      >
        <VoidPaymentDialog action={action} month="2026-10" amountAgorot={35_000} />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: /^Void the payment for October 2026, ₪\s?350$/ })
}

describe('VoidPaymentDialog', () => {
  it('asks why, with focus on the reason', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(vi.fn(async (): Promise<VoidPaymentState> => ({}))))
    // The dialog's code loads on first open.
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Void the payment for October 2026?',
    })

    expect(dialog).toHaveAccessibleDescription(/stops counting, and October 2026 is owed again/)
    expect(screen.getByLabelText(copy.reason)).toHaveFocus()
  })

  it('keeps the dialog open with the error when the reason is refused', async () => {
    const user = userEvent.setup()
    const refused: VoidPaymentState = {
      values: { reason: 'x' },
      errors: { reason: [en.PaymentErrors.reason] },
      message: null,
    }
    await user.click(renderDialog(vi.fn(async () => refused)))
    await screen.findByRole('alertdialog')
    await user.type(screen.getByLabelText(copy.reason), 'x')
    await user.click(screen.getByRole('button', { name: copy.confirm }))

    const reason = await screen.findByLabelText(copy.reason)
    await waitFor(() => expect(reason).toHaveFocus())
    expect(reason).toHaveValue('x')
    expect(reason).toHaveAccessibleDescription(`${copy.reasonHint} ${en.PaymentErrors.reason}`)
  })

  it('sends the reason, then moves focus to the heading and says it was voided', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<VoidPaymentState> => ({
      message: null,
      voided: { apartmentNumber: '4', month: '2026-10', amountAgorot: 35_000 },
    }))
    await user.click(renderDialog(action))
    await screen.findByRole('alertdialog')
    await user.type(screen.getByLabelText(copy.reason), 'Recorded twice')
    await user.click(screen.getByRole('button', { name: copy.confirm }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Apartment 4' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      /^The payment for October 2026 \(₪\s?350\) was voided$/,
    )
    const sent = action.mock.calls[0] as unknown as [VoidPaymentState, FormData]
    expect(sent[1].get('reason')).toBe('Recorded twice')
  })
})
