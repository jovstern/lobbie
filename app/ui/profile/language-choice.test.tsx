import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingState } from '@/app/lib/actions/users'
import LanguageChoice from '@/app/ui/profile/language-choice'
import en from '@/messages/en.json'

const copy = en.LanguageChoice

type Action = (state: SettingState, formData: FormData) => Promise<SettingState>

function renderChoice(action: Action) {
  return render(
    <NextIntlClientProvider locale="he" messages={{ LanguageChoice: copy, Common: en.Common }}>
      <h2 id="language-title">Language</h2>
      <LanguageChoice action={action} labelledBy="language-title" />
    </NextIntlClientProvider>,
  )
}

/** A save the test finishes when it chooses. */
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

describe('LanguageChoice', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('focuses the chosen language and says it is saved when the page opens at #language', () => {
    window.history.replaceState(null, '', '/en/profile#language')
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('button', { name: copy.he })).toHaveFocus()
    expect(screen.getByText(en.Common.saved).closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('leaves focus alone on an ordinary visit, with nothing said', () => {
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('button', { name: copy.he })).not.toHaveFocus()
    expect(screen.queryByText(en.Common.saved)).not.toBeInTheDocument()
  })

  it('is a group of two toggle buttons named by its heading, the page’s language pressed', () => {
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('group', { name: 'Language' })).toHaveAccessibleDescription(
      // The empty status region adds a space at the end.
      expect.stringContaining(copy.hint),
    )
    expect(screen.getByRole('button', { name: copy.he })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: copy.en })).toHaveAttribute('aria-pressed', 'false')
    // Each language is named in itself, for screen readers too.
    expect(screen.getByRole('button', { name: copy.en })).toHaveAttribute('lang', 'en')
  })

  it('never saves from an arrow key: Tab moves between the languages, Enter saves', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: null })
    renderChoice(action)

    await user.tab()
    expect(screen.getByRole('button', { name: copy.he })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowDown}')
    expect(action).not.toHaveBeenCalled()

    await user.tab()
    const english = screen.getByRole('button', { name: copy.en })
    expect(english).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(english).toHaveAttribute('aria-pressed', 'true')
    expect(action).toHaveBeenCalledTimes(1)
    expect(action.mock.calls[0][1].get('locale')).toBe('en')
    finish()
  })

  it('does nothing when the pressed language is pressed again', async () => {
    const user = userEvent.setup()
    const action = vi.fn<Action>()
    renderChoice(action)

    await user.click(screen.getByRole('button', { name: copy.he }))

    expect(action).not.toHaveBeenCalled()
  })

  it('falls back to the page’s language when the save fails, and announces why', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: en.ProfileErrors.saveFailed })
    renderChoice(action)

    await user.click(screen.getByRole('button', { name: copy.en }))
    finish()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: copy.he })).toHaveAttribute('aria-pressed', 'true'),
    )
    const message = screen.getByText(en.ProfileErrors.saveFailed)
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
  })
})
