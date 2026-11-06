import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SearchField from '@/app/ui/search-field'
import en from '@/messages/en.json'

const replace = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/people',
  useRouter: () => ({ replace }),
}))

const copy = en.Search
const label = 'Search people'

function search(query: string) {
  return (
    <NextIntlClientProvider locale="en" messages={{ Search: copy }}>
      <SearchField query={query} label={label} hint="A name." />
    </NextIntlClientProvider>
  )
}

beforeEach(() => replace.mockClear())

describe('SearchField', () => {
  it('sends the search after a pause', async () => {
    const user = userEvent.setup()
    render(search(''))

    await user.type(screen.getByLabelText(label), ' ana ')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/admin/people?q=ana', { scroll: false }),
    )
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('clears the search and keeps focus on the field', async () => {
    const user = userEvent.setup()
    render(search('nobody'))
    const field = screen.getByLabelText(label)
    expect(field).toHaveValue('nobody')

    await user.click(screen.getByRole('button', { name: copy.clearLabel }))

    expect(replace).toHaveBeenCalledWith('/admin/people', { scroll: false })
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
  })

  it('drops typing still on its way when Clear is pressed', async () => {
    const user = userEvent.setup()
    render(search(''))
    await user.type(screen.getByLabelText(label), 'ana')

    await user.click(screen.getByRole('button', { name: copy.clearLabel }))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/admin/people', { scroll: false })
  })

  it('follows back and forward without a pending search bringing old text back', async () => {
    const user = userEvent.setup()
    const { rerender } = render(search('ana'))
    const field = screen.getByLabelText(label)
    await user.type(field, 'x')

    // Back: the URL's search changes before the pause is over.
    rerender(search('dan'))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(field).toHaveValue('dan')
    expect(replace).not.toHaveBeenCalled()
  })
})
