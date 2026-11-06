import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ProfileFormState } from '@/app/lib/actions/users'
import ProfileForm from '@/app/ui/profile/profile-form'
import en from '@/messages/en.json'

// next-intl's navigation cannot load in Vitest; the welcome link only needs an anchor.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))
const search = vi.hoisted(() => ({ value: '' }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }))

const copy = en.ProfileForm
const saved = { name: 'Dana Zur', phone: '050-555-0101' }

type Action = (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>

function renderForm(action: Action) {
  render(
    <NextIntlClientProvider locale="en" messages={{ ProfileForm: copy }}>
      <ProfileForm action={action} saved={saved} email="dana@example.com" />
    </NextIntlClientProvider>,
  )
}

describe('ProfileForm', () => {
  it('after joining, asks for the name, then keeps the callout with the way home', async () => {
    search.value = 'welcome=1'
    const user = userEvent.setup()
    const action = vi.fn<Action>(async () => ({
      values: { name: 'Dana Zur', phone: '' },
      savedAt: 1,
      message: null,
    }))
    render(
      <NextIntlClientProvider locale="en" messages={{ ProfileForm: copy }}>
        <ProfileForm action={action} saved={saved} email="dana@example.com" askForName />
      </NextIntlClientProvider>,
    )
    expect(screen.getByText(copy.welcomeTitle)).toBeVisible()

    await user.click(screen.getByRole('button', { name: copy.save }))

    expect(await screen.findByText(copy.welcomeDoneTitle)).toBeVisible()
    expect(screen.getByRole('link', { name: copy.continueHome })).toHaveAttribute('href', '/')
    search.value = ''
  })

  it('shows the saved details, and the email as the sign-in address it cannot change', () => {
    renderForm(vi.fn<Action>())

    expect(screen.getByLabelText(copy.name)).toHaveValue(saved.name)
    expect(screen.getByLabelText(copy.phone)).toHaveValue(saved.phone)
    expect(screen.getByLabelText(copy.phone)).toHaveAccessibleDescription(
      // The empty error region adds a space at the end.
      expect.stringContaining(copy.phoneHint),
    )
    expect(screen.getByText('dana@example.com')).toBeVisible()
    expect(screen.getByText(copy.emailHint)).toBeVisible()
    expect(screen.queryByRole('textbox', { name: copy.email })).not.toBeInTheDocument()
  })

  it('keeps what was typed after an error, and focuses the first field with one', async () => {
    const user = userEvent.setup()
    const typed = { name: 'Dana Z', phone: '123' }
    const action = vi.fn<Action>(async () => ({
      values: typed,
      errors: { phone: [en.ProfileErrors.phone] },
      message: null,
    }))
    renderForm(action)

    await user.clear(screen.getByLabelText(copy.name))
    await user.type(screen.getByLabelText(copy.name), typed.name)
    await user.clear(screen.getByLabelText(copy.phone))
    await user.type(screen.getByLabelText(copy.phone), typed.phone)
    await user.click(screen.getByRole('button', { name: copy.save }))

    const phone = screen.getByLabelText(copy.phone)
    expect(await screen.findByText(en.ProfileErrors.phone)).toBeVisible()
    expect(phone).toHaveFocus()
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(phone).toHaveValue(typed.phone)
    expect(screen.getByLabelText(copy.name)).toHaveValue(typed.name)
    const sent = action.mock.calls[0][1]
    expect(sent.get('name')).toBe(typed.name)
    expect(sent.get('phone')).toBe(typed.phone)
  })

  it('announces a save, showing the details as saved', async () => {
    const user = userEvent.setup()
    renderForm(
      vi.fn<Action>(async () => ({
        values: { name: 'Dana Zur', phone: '054-555-0301' },
        message: null,
        savedAt: 1,
      })),
    )

    await user.click(screen.getByRole('button', { name: copy.save }))

    expect(await screen.findByText(copy.saved)).toBeVisible()
    expect(screen.getByLabelText(copy.phone)).toHaveValue('054-555-0301')
  })
})
