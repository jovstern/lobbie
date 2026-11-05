import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { CreateAllState } from '@/app/lib/actions/invites'
import InviteAll from '@/app/ui/admin/invite-all'
import en from '@/messages/en.json'

const copy = en.InviteAll
const invite = (number: string) => ({
  apartmentId: `apartment-${number}`,
  apartmentNumber: number,
  code: 'ABCDE-23456',
  link: `https://lobbie.example/join/CODE${number}`,
})
const listed: CreateAllState = { message: null, created: [invite('2'), invite('10')], skipped: 0 }

function renderInviteAll(
  missingAction: () => Promise<CreateAllState>,
  { activeCount = 0, allAction = vi.fn(async () => listed) } = {},
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ InviteAll: copy, CopyButton: en.CopyButton }}>
      <InviteAll
        missingAction={missingAction}
        allAction={allAction}
        apartmentCount={3}
        activeCount={activeCount}
      />
    </NextIntlClientProvider>,
  )
}

describe('InviteAll', () => {
  it('lists the new links and copies them all as lines, each link isolated', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderInviteAll(vi.fn(async () => listed))

    await user.click(screen.getByRole('button', { name: copy.open }))
    const list = await screen.findByRole('list', { name: copy.listLabel })
    expect(screen.getByRole('heading', { name: '2 new invite links' })).toHaveFocus()
    expect(list).toHaveTextContent('https://lobbie.example/join/CODE10')

    await user.click(screen.getByRole('button', { name: copy.copyAll }))
    expect(writeText).toHaveBeenCalledWith(
      'Apartment 2: ⁨https://lobbie.example/join/CODE2⁩\n' +
        'Apartment 10: ⁨https://lobbie.example/join/CODE10⁩',
    )
  })

  it('keeps links not yet copied when a later run creates none', async () => {
    const user = userEvent.setup()
    const missingAction = vi
      .fn<() => Promise<CreateAllState>>()
      .mockResolvedValueOnce(listed)
      .mockResolvedValueOnce({ message: null, created: [], skipped: 3 })
    renderInviteAll(missingAction)

    await user.click(screen.getByRole('button', { name: copy.open }))
    await screen.findByRole('list', { name: copy.listLabel })
    await user.click(screen.getByRole('button', { name: copy.open }))

    await waitFor(() => expect(missingAction).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('list', { name: copy.listLabel })).toHaveTextContent(
      'https://lobbie.example/join/CODE2',
    )
  })

  it('disables both choices while either is running', async () => {
    const user = userEvent.setup()
    const never = () => new Promise<CreateAllState>(() => {})
    renderInviteAll(vi.fn(never), { activeCount: 1 })

    await user.click(screen.getByRole('button', { name: copy.open }))
    await user.click(screen.getByRole('button', { name: 'Only the 2 without an invite' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replace it too' })).toBeDisabled(),
    )
    expect(screen.getByRole('button', { name: copy.creating })).toBeDisabled()
  })
})
