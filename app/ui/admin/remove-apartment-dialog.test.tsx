import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { RemoveApartmentState } from '@/app/lib/actions/apartments'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import RemoveApartmentDialog from '@/app/ui/admin/remove-apartment-dialog'
import en from '@/messages/en.json'

const copy = en.ApartmentRemove
const reason = 'Move or remove its 2 residents first.'
const blocked = { summary: 'Has residents', reason }

function renderRemove(
  action: () => Promise<RemoveApartmentState> = vi.fn(async () => ({})),
  blockedBy: { summary: string; reason: string } | null = null,
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ ApartmentRemove: copy }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Apartments
          </h1>
        }
      >
        <RemoveApartmentDialog action={action} number="7" blocked={blockedBy} reasonId="reason-7" />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'Remove apartment 7' })
}

describe('RemoveApartmentDialog', () => {
  it('while blocked, says so in a few words, and opens the full reason instead of asking', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({}))
    const button = renderRemove(action, blocked)

    expect(button).toHaveAccessibleDescription('Has residents')
    expect(screen.getByText('Has residents')).toBeVisible()

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')

    // The dialog's code loads on first open.
    const dialog = await screen.findByRole('dialog', { name: 'Apartment 7 can’t be removed yet' })
    expect(dialog).toHaveAccessibleDescription(reason)
    expect(screen.queryByRole('button', { name: copy.confirm })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.blockedClose }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(action).not.toHaveBeenCalled()
  })

  it('asks first, with Cancel focused, and Escape returns focus to the button', async () => {
    const user = userEvent.setup()
    const button = renderRemove()

    await user.click(button)
    // The dialog's code loads on first open.
    await screen.findByRole('alertdialog')

    const dialog = screen.getByRole('alertdialog', { name: 'Remove apartment 7?' })
    expect(dialog).toHaveAccessibleDescription(copy.description)
    expect(screen.getByRole('button', { name: copy.cancel })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('shows why the server refused, and the next opening starts clean', async () => {
    const user = userEvent.setup()
    const refused: RemoveApartmentState = { message: `It can’t be removed yet. ${reason}` }
    const button = renderRemove(vi.fn(async () => refused))
    await user.click(button)
    // The dialog's code loads on first open.
    await screen.findByRole('alertdialog')

    await user.click(screen.getByRole('button', { name: copy.confirm }))

    expect(await screen.findByText(refused.message ?? '')).toBeVisible()
    await user.click(screen.getByRole('button', { name: copy.cancel }))
    await user.click(button)
    // The dialog's code loads on first open.
    await screen.findByRole('alertdialog')
    expect(screen.queryByText(refused.message ?? '')).not.toBeInTheDocument()
  })

  it('once removed, closes, announces it and moves focus to the heading', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ removed: true, message: null }))
    renderRemove(action)
    await user.click(screen.getByRole('button', { name: 'Remove apartment 7' }))
    // The dialog's code loads on first open.
    await screen.findByRole('alertdialog')

    await user.click(screen.getByRole('button', { name: copy.confirm }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Apartment 7 removed')
    expect(screen.getByRole('heading', { name: 'Apartments' })).toHaveFocus()
  })
})
