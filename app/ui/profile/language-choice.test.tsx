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
    <NextIntlClientProvider locale="he" messages={{ LanguageChoice: copy }}>
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

  it('focuses the checked language when the page opens at #language, after a change', () => {
    window.history.replaceState(null, '', '/en/profile#language')
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('radio', { name: copy.he })).toHaveFocus()
  })

  it('leaves focus alone on an ordinary visit', () => {
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('radio', { name: copy.he })).not.toHaveFocus()
  })

  it('is a group named by its heading, with the page’s language checked', () => {
    renderChoice(vi.fn<Action>())

    expect(screen.getByRole('group', { name: 'Language' })).toHaveAccessibleDescription(
      // The empty status region adds a space at the end.
      expect.stringContaining(copy.hint),
    )
    expect(screen.getByRole('radio', { name: copy.he })).toBeChecked()
    expect(screen.getByRole('radio', { name: copy.en })).not.toBeChecked()
    // Each language is named in itself, for screen readers too.
    expect(screen.getByText(copy.en).closest('label')).toHaveAttribute('lang', 'en')
  })

  it('is operated with the keyboard: Tab reaches the choice, an arrow saves the other', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: null })
    renderChoice(action)

    await user.tab()
    expect(screen.getByRole('radio', { name: copy.he })).toHaveFocus()
    await user.keyboard('{ArrowDown}')

    const english = screen.getByRole('radio', { name: copy.en })
    expect(english).toHaveFocus()
    expect(english).toBeChecked()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action.mock.calls[0][1].get('locale')).toBe('en')
    finish()
  })

  it('falls back to the page’s language when the save fails, and announces why', async () => {
    const user = userEvent.setup()
    const { action, finish } = pendingSave({ message: en.ProfileErrors.saveFailed })
    renderChoice(action)

    await user.click(screen.getByRole('radio', { name: copy.en }))
    finish()

    await waitFor(() => expect(screen.getByRole('radio', { name: copy.he })).toBeChecked())
    const message = screen.getByText(en.ProfileErrors.saveFailed)
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
  })
})
