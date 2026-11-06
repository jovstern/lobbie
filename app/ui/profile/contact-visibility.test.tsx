import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { SettingState } from '@/app/lib/actions/users'
import ContactVisibility from '@/app/ui/profile/contact-visibility'
import en from '@/messages/en.json'

const copy = en.ContactVisibility

type Action = (state: SettingState, formData: FormData) => Promise<SettingState>

function renderSwitch(action: Action, { showContact = false, hasPhone = true } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ContactVisibility: copy, Common: en.Common }}>
      <ContactVisibility action={action} showContact={showContact} hasPhone={hasPhone} />
    </NextIntlClientProvider>,
  )
}

/** A save the test finishes when it chooses, to see the control while it is on its way. */
function pendingSave(answer: SettingState) {
  let finish = () => {}
  const action = vi.fn<Action>(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(answer)
      }),
  )
  return { action, finish: () => finish() }
}

describe('ContactVisibility', () => {
  it('is a named switch, as saved, described by its hint', () => {
    renderSwitch(vi.fn<Action>(), { showContact: true })

    const control = screen.getByRole('switch', { name: copy.label })
    expect(control).toBeChecked()
    expect(control).toHaveAccessibleDescription(
      // The empty status region adds a space at the end.
      expect.stringContaining(copy.hint),
    )
    expect(screen.queryByText(copy.noPhoneHint)).not.toBeInTheDocument()
  })

  it('says only the email will show when there is no phone', () => {
    renderSwitch(vi.fn<Action>(), { hasPhone: false })

    expect(screen.getByRole('switch', { name: copy.label })).toHaveAccessibleDescription(
      // The empty status region adds a space at the end.
      expect.stringContaining(`${copy.hint} ${copy.noPhoneHint}`),
    )
  })

  it('turns on at once from the keyboard and sends the new value', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: null })
    renderSwitch(action)

    await user.tab()
    expect(screen.getByRole('switch', { name: copy.label })).toHaveFocus()
    await user.keyboard(' ')

    expect(screen.getByRole('switch', { name: copy.label })).toBeChecked()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action.mock.calls[0][1].get('showContact')).toBe('true')
    finish()
  })

  it('falls back to the saved value when the save fails, and announces why', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: en.ProfileErrors.saveFailed })
    renderSwitch(action)

    await user.click(screen.getByRole('switch', { name: copy.label }))
    expect(screen.getByRole('switch', { name: copy.label })).toBeChecked()
    finish()

    await waitFor(() => expect(screen.getByRole('switch', { name: copy.label })).not.toBeChecked())
    const message = screen.getByText(en.ProfileErrors.saveFailed)
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('keeps the new value once the page has the saved one', async () => {
    const user = userEvent.setup()
    const action = vi.fn<Action>(async () => ({ message: null }))
    const { rerender } = renderSwitch(action)

    await user.click(screen.getByRole('switch', { name: copy.label }))
    // The server's refresh: the saved value is now "on".
    rerender(
      <NextIntlClientProvider locale="en" messages={{ ContactVisibility: copy, Common: en.Common }}>
        <ContactVisibility action={action} showContact hasPhone />
      </NextIntlClientProvider>,
    )

    await waitFor(() => expect(screen.getByRole('switch', { name: copy.label })).toBeChecked())
    expect(screen.queryByText(en.ProfileErrors.saveFailed)).not.toBeInTheDocument()
  })

  it('says "Saved" once the change is saved', async () => {
    const user = userEvent.setup()
    renderSwitch(vi.fn<Action>(async () => ({ message: null })))

    await user.click(screen.getByRole('switch', { name: copy.label }))

    const saved = await screen.findByText(en.Common.saved)
    expect(saved.closest('[aria-live="polite"]')).not.toBeNull()
  })
})
