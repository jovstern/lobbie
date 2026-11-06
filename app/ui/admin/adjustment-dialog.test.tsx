import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { AdjustmentFormState } from '@/app/lib/actions/buildings'
import AdjustmentDialog from '@/app/ui/admin/adjustment-dialog'
import type { AdjustmentAction } from '@/app/ui/admin/adjustment-form'
import en from '@/messages/en.json'

const copy = en.AdjustmentForm

function renderDialog(action: AdjustmentAction = vi.fn(async () => ({}))) {
  render(
    <NextIntlClientProvider locale="en" messages={{ AdjustmentForm: copy }}>
      <AdjustmentDialog action={action} />
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: copy.open })
}

describe('AdjustmentDialog', () => {
  it('opens a labelled dialog with focus on the first choice', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog()

    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')

    const dialog = screen.getByRole('dialog', { name: copy.title })
    expect(dialog).toHaveAccessibleDescription(copy.description)
    expect(screen.getByLabelText(copy.in)).toHaveFocus()
  })

  it('closes with Escape and returns focus to the button', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog()
    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes from Cancel too, and opens empty again', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog()
    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText(copy.amount), '250')

    await user.click(screen.getByRole('button', { name: copy.cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    expect(screen.getByLabelText(copy.amount)).toHaveValue('')
  })

  it('keeps what was typed and focuses the first field with an error', async () => {
    const user = userEvent.setup()
    const failed: AdjustmentFormState = {
      values: { direction: 'out', amount: '0', reason: 'Bank fees' },
      errors: { amount: [en.AdjustmentErrors.amount] },
      message: null,
    }
    renderDialog(vi.fn(async () => failed))
    await user.click(screen.getByRole('button', { name: copy.open }))
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    await user.click(screen.getByLabelText(copy.out))
    await user.type(screen.getByLabelText(copy.amount), '0')
    await user.type(screen.getByLabelText(copy.reason), 'Bank fees')

    await user.click(screen.getByRole('button', { name: copy.submit }))

    const amount = await screen.findByLabelText(copy.amount)
    await waitFor(() => expect(amount).toHaveFocus())
    expect(amount).toHaveAccessibleDescription(`${copy.amountHint} ${en.AdjustmentErrors.amount}`)
    expect(amount).toHaveValue('0')
    expect(screen.getByLabelText(copy.out)).toBeChecked()
    expect(screen.getByLabelText(copy.reason)).toHaveValue('Bank fees')
  })

  it('closes once the adjustment is added, announces it and returns focus', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog(vi.fn(async () => ({ added: true, message: null })))
    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    await user.click(screen.getByLabelText(copy.in))
    await user.type(screen.getByLabelText(copy.amount), '250')
    await user.type(screen.getByLabelText(copy.reason), 'Interest')

    await user.click(screen.getByRole('button', { name: copy.submit }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(copy.added)
    expect(trigger).toHaveFocus()
  })
})
