import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { SignInState } from '@/app/lib/actions/auth'
import SignInForm from '@/app/ui/auth/sign-in-form'
import en from '@/messages/en.json'

function renderForm(action: (state: SignInState, formData: FormData) => Promise<SignInState>) {
  render(
    <NextIntlClientProvider locale="en" messages={{ SignInForm: en.SignInForm }}>
      <SignInForm action={action} />
    </NextIntlClientProvider>,
  )
  return screen.getByLabelText('Email')
}

describe('SignInForm', () => {
  it('keeps the typed email, words the wait in minutes and returns focus to the field', async () => {
    const user = userEvent.setup()
    const input = renderForm(async (_state, formData) => ({
      email: String(formData.get('email')),
      message: null,
      retryAfterSeconds: 361,
    }))

    await user.type(input, 'dana@example.com')
    await user.click(screen.getByRole('button', { name: 'Send me a link' }))

    const message = 'Too many attempts; try again in 7 minutes.'
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(input).toHaveValue('dana@example.com')
    expect(input).toHaveFocus()
    expect(input).toHaveAccessibleDescription(message)
    // Waiting is not the field's fault.
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('marks the field invalid for a field error', async () => {
    const user = userEvent.setup()
    const error = 'Enter an email address like name@example.com.'
    const input = renderForm(async () => ({ email: 'x', errors: { email: [error] } }))

    await user.type(input, 'dana@example.com')
    await user.click(screen.getByRole('button', { name: 'Send me a link' }))

    expect(await screen.findByText(error)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
  })

  it('shows "Sending…" and disables the button while the request is in flight', async () => {
    const user = userEvent.setup()
    let finish: (state: SignInState) => void = () => {}
    const input = renderForm(() => new Promise((resolve) => (finish = resolve)))

    await user.type(input, 'dana@example.com')
    await user.click(screen.getByRole('button', { name: 'Send me a link' }))

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
    finish({})
    expect(await screen.findByRole('button', { name: 'Send me a link' })).toBeEnabled()
  })
})
