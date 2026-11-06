import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { OwnershipState } from '@/app/lib/actions/residents'
import OwnershipToggle from '@/app/ui/admin/ownership-toggle'
import en from '@/messages/en.json'

const copy = en.ResidentsClient

type Action = (state: OwnershipState, formData: FormData) => Promise<OwnershipState>

function renderToggle(action: Action, isOwner = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ResidentsClient: copy, Common: en.Common }}>
      <OwnershipToggle action={action} isOwner={isOwner} name="Ana" userId="user-1" />
    </NextIntlClientProvider>,
  )
}

/** A save the test finishes when it chooses, to see the control while it is on its way. */
function pendingSave(answer: OwnershipState) {
  let finish = () => {}
  const action = vi.fn<Action>(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(answer)
      }),
  )
  return { action, finish: () => finish() }
}

describe('OwnershipToggle', () => {
  it('is a named group with the saved choice checked', () => {
    renderToggle(vi.fn<Action>())

    expect(screen.getByRole('group', { name: 'Ana lives here as' })).toBeVisible()
    expect(screen.getByRole('radio', { name: copy.owner })).toBeChecked()
    expect(screen.getByRole('radio', { name: copy.tenant })).not.toBeChecked()
  })

  it('shows the new choice at once and sends it', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: null })
    renderToggle(action)

    await user.click(screen.getByRole('radio', { name: copy.tenant }))

    expect(screen.getByRole('radio', { name: copy.tenant })).toBeChecked()
    expect(action).toHaveBeenCalledTimes(1)
    const sent = action.mock.calls[0][1]
    expect(sent.get('isOwner')).toBe('false')
    finish()
  })

  it('falls back to the saved choice when the save fails, and says why', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: 'We couldn’t save the change.' })
    renderToggle(action)

    await user.click(screen.getByRole('radio', { name: copy.tenant }))
    expect(screen.getByRole('radio', { name: copy.tenant })).toBeChecked()
    finish()

    await waitFor(() => expect(screen.getByRole('radio', { name: copy.owner })).toBeChecked())
    const message = screen.getByText('We couldn’t save the change.')
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('keeps the new choice once the page has the saved one', async () => {
    const user = userEvent.setup()
    const action = vi.fn<Action>(async () => ({ message: null }))
    const { rerender } = renderToggle(action)

    await user.click(screen.getByRole('radio', { name: copy.tenant }))
    // The server's refresh: the saved value is now "tenant".
    rerender(
      <NextIntlClientProvider locale="en" messages={{ ResidentsClient: copy, Common: en.Common }}>
        <OwnershipToggle action={action} isOwner={false} name="Ana" userId="user-1" />
      </NextIntlClientProvider>,
    )

    await waitFor(() => expect(screen.getByRole('radio', { name: copy.tenant })).toBeChecked())
    expect(screen.queryByText(en.ResidentErrors.saveFailed)).not.toBeInTheDocument()
  })

  it('says "Saved" after each save that worked, in the group’s live description', async () => {
    const user = userEvent.setup()
    renderToggle(vi.fn<Action>(async () => ({ message: null })))

    await user.click(screen.getByRole('radio', { name: copy.tenant }))

    const saved = await screen.findByText(en.Common.saved)
    expect(saved.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Ana lives here as' })).toHaveAccessibleDescription(
      en.Common.saved,
    )
  })
})
