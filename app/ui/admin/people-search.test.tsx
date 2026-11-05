import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PeopleSearch from '@/app/ui/admin/people-search'
import en from '@/messages/en.json'

const replace = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/admin/people',
  useRouter: () => ({ replace }),
}))

const copy = en.People

function search(query: string) {
  return (
    <NextIntlClientProvider locale="en" messages={{ People: copy }}>
      <PeopleSearch query={query} />
    </NextIntlClientProvider>
  )
}

beforeEach(() => replace.mockClear())

describe('PeopleSearch', () => {
  it('sends the search after a pause', async () => {
    const user = userEvent.setup()
    render(search(''))

    await user.type(screen.getByLabelText(copy.searchLabel), ' ana ')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/admin/people?q=ana', { scroll: false }),
    )
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('clears the search and keeps focus on the field', async () => {
    const user = userEvent.setup()
    render(search('nobody'))
    const field = screen.getByLabelText(copy.searchLabel)
    expect(field).toHaveValue('nobody')

    await user.click(screen.getByRole('button', { name: copy.clearSearchLabel }))

    expect(replace).toHaveBeenCalledWith('/admin/people', { scroll: false })
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
  })

  it('drops typing still on its way when Clear is pressed', async () => {
    const user = userEvent.setup()
    render(search(''))
    await user.type(screen.getByLabelText(copy.searchLabel), 'ana')

    await user.click(screen.getByRole('button', { name: copy.clearSearchLabel }))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/admin/people', { scroll: false })
  })

  it('follows back and forward without a pending search bringing old text back', async () => {
    const user = userEvent.setup()
    const { rerender } = render(search('ana'))
    const field = screen.getByLabelText(copy.searchLabel)
    await user.type(field, 'x')

    // Back: the URL's search changes before the pause is over.
    rerender(search('dan'))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(field).toHaveValue('dan')
    expect(replace).not.toHaveBeenCalled()
  })
})
