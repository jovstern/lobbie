import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { ApartmentFormState } from '@/app/lib/actions/apartments'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import type { ApartmentAction } from '@/app/ui/admin/apartment-form'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import en from '@/messages/en.json'

const copy = en.ApartmentForm
const saved = { number: '7', floor: '3', billingStartMonth: '' }

type Options = {
  action?: ApartmentAction
  confirmedAction?: ApartmentAction
  editing?: boolean
  focusHeadingAfterSave?: boolean
}

function renderDialog({
  action = vi.fn(async () => ({})),
  confirmedAction,
  editing = false,
  focusHeadingAfterSave = false,
}: Options = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={{ ApartmentForm: copy }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Apartments
          </h1>
        }
      >
        <ApartmentDialog
          action={action}
          confirmedAction={confirmedAction}
          saved={editing ? saved : undefined}
          focusHeadingAfterSave={focusHeadingAfterSave}
        />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: editing ? 'Edit apartment 7' : copy.open })
}

describe('ApartmentDialog', () => {
  it('opens a labelled dialog with focus on the number', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog()

    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')

    const dialog = screen.getByRole('dialog', { name: copy.addTitle })
    expect(dialog).toHaveAccessibleDescription(copy.addDescription)
    expect(screen.getByLabelText(copy.number)).toHaveFocus()
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

  it('opens an edit with the saved values, named after the apartment', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog({ editing: true })

    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')

    expect(screen.getByRole('dialog', { name: 'Edit apartment 7' })).toBeVisible()
    expect(screen.getByLabelText(copy.number)).toHaveValue('7')
    expect(screen.getByLabelText(copy.floor)).toHaveValue(3)
  })

  it('shows a duplicate number on its field, focused, keeping what was typed', async () => {
    const user = userEvent.setup()
    const failed: ApartmentFormState = {
      values: { number: '7', floor: '2', billingStartMonth: '' },
      errors: { number: ['Apartment 7 already exists.'] },
      message: null,
    }
    renderDialog({ action: vi.fn(async () => failed) })
    await user.click(screen.getByRole('button', { name: copy.open }))
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText(copy.number), '7')
    await user.type(screen.getByLabelText(copy.floor), '2')

    await user.click(screen.getByRole('button', { name: copy.add }))

    const number = await screen.findByLabelText(copy.number)
    await waitFor(() => expect(number).toHaveFocus())
    expect(number).toHaveAccessibleDescription(`${copy.numberHint} Apartment 7 already exists.`)
    expect(number).toHaveValue('7')
    expect(screen.getByLabelText(copy.floor)).toHaveValue(2)
  })

  it('asks before changing the billing start, focusing the warning, and saves on confirm', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<ApartmentFormState> => ({
      values: { ...saved, billingStartMonth: '2026-03' },
      message: null,
      confirmBillingChange: { from: null, to: '2026-03' },
    }))
    const confirmedAction = vi.fn(async (): Promise<ApartmentFormState> => ({
      saved: { number: '7' },
      message: null,
    }))
    const trigger = renderDialog({ action, confirmedAction, editing: true })
    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: copy.save }))

    const warning = await screen.findByText(copy.confirmTitle)
    await waitFor(() => expect(warning.parentElement).toHaveFocus())
    // Announced once, by the focus: a named group, not also a live region.
    expect(warning.parentElement).toHaveAccessibleName(copy.confirmTitle)
    expect(warning.closest('[aria-live]')).toBeNull()
    expect(warning.parentElement).toHaveTextContent(
      'Billing would start in March 2026 instead of in the building’s month.',
    )
    expect(confirmedAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: copy.saveAnyway }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(confirmedAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Apartment 7 saved')
    expect(trigger).toHaveFocus()
  })

  it('after adding from the empty state, announces it and moves focus to the heading', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog({
      action: vi.fn(async () => ({ saved: { number: '12A' }, message: null })),
      focusHeadingAfterSave: true,
    })
    await user.click(trigger)
    // The dialog's code loads on first open.
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText(copy.number), '12A')
    await user.type(screen.getByLabelText(copy.floor), '4')

    await user.click(screen.getByRole('button', { name: copy.add }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Apartment 12A added')
    expect(screen.getByRole('heading', { name: 'Apartments' })).toHaveFocus()
  })
})
