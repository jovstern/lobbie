import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import CopyButton from '@/app/ui/copy-button'
import en from '@/messages/en.json'

function renderCopy() {
  render(
    <NextIntlClientProvider locale="en" messages={{ CopyButton: en.CopyButton }}>
      <p id="link">https://lobbie.example/join/ABCDE23456</p>
      <CopyButton
        text="https://lobbie.example/join/ABCDE23456"
        label="Copy link"
        accessibleLabel="Copy the link for apartment 7"
        sourceId="link"
      />
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'Copy the link for apartment 7' })
}

describe('CopyButton', () => {
  it('copies the text and says so in a live region', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const button = renderCopy()
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()

    await user.click(button)

    expect(writeText).toHaveBeenCalledWith('https://lobbie.example/join/ABCDE23456')
    expect(status).toHaveTextContent(en.CopyButton.copied)
  })

  it('works from the keyboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderCopy()

    await user.tab()
    await user.keyboard('{Enter}')

    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('selects the text for a manual copy when the clipboard refuses', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    const button = renderCopy()

    await user.click(button)

    expect(screen.getByRole('status')).toHaveTextContent(en.CopyButton.copyFailed)
    expect(window.getSelection()?.toString()).toBe('https://lobbie.example/join/ABCDE23456')
  })
})
