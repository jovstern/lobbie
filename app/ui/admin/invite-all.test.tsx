import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CreateAllState } from '@/app/lib/actions/invites'
import CreatedInvitesProvider from '@/app/ui/admin/created-invites-provider'
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

function inviteAll(
  missingAction: () => Promise<CreateAllState>,
  { activeCount = 0, allAction = vi.fn(async () => listed) } = {},
) {
  return (
    <InviteAll
      missingAction={missingAction}
      allAction={allAction}
      apartmentCount={3}
      activeCount={activeCount}
    />
  )
}

function renderInviteAll(...args: Parameters<typeof inviteAll>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ InviteAll: copy, CopyButton: en.CopyButton }}>
      <CreatedInvitesProvider>{inviteAll(...args)}</CreatedInvitesProvider>
    </NextIntlClientProvider>,
  )
}

describe('InviteAll', () => {
  it('lists the new links and copies them all, each link on the line below its apartment', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderInviteAll(vi.fn(async () => listed))

    await user.click(screen.getByRole('button', { name: copy.open }))
    const list = await screen.findByRole('list', { name: copy.listLabel })
    expect(screen.getByRole('heading', { name: '2 new invite links' })).toHaveFocus()
    expect(list).toHaveTextContent('https://lobbie.example/join/CODE10')

    await user.click(screen.getByRole('button', { name: copy.copyAll }))
    expect(writeText).toHaveBeenCalledWith(
      'Apartment 2:\nhttps://lobbie.example/join/CODE2\n' +
        'Apartment 10:\nhttps://lobbie.example/join/CODE10',
    )
  })

  it('gives way to the links until the admin is done with them, then offers it again', async () => {
    const user = userEvent.setup()
    renderInviteAll(vi.fn(async () => listed))

    await user.click(screen.getByRole('button', { name: copy.open }))
    await screen.findByRole('list', { name: copy.listLabel })
    expect(screen.queryByRole('button', { name: copy.open })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: copy.done }))

    expect(screen.queryByRole('list', { name: copy.listLabel })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.open })).toBeVisible()
  })

  it('keeps the links while the page is left and opened again within the section', async () => {
    const user = userEvent.setup()
    const missingAction = vi.fn(async () => listed)
    const { rerender } = renderInviteAll(missingAction)
    await user.click(screen.getByRole('button', { name: copy.open }))
    await screen.findByRole('list', { name: copy.listLabel })

    // The section's layout keeps the provider while its pages change below it.
    const provided = (children: ReactNode) => (
      <NextIntlClientProvider locale="en" messages={{ InviteAll: copy, CopyButton: en.CopyButton }}>
        <CreatedInvitesProvider>{children}</CreatedInvitesProvider>
      </NextIntlClientProvider>
    )
    rerender(provided(<p>An apartment’s page</p>))
    expect(screen.queryByRole('list', { name: copy.listLabel })).not.toBeInTheDocument()
    rerender(provided(inviteAll(missingAction, { activeCount: 3 })))

    expect(screen.getByRole('list', { name: copy.listLabel })).toHaveTextContent(
      'https://lobbie.example/join/CODE10',
    )
  })

  it('offers the recommended choice first, then replacing, then Cancel', async () => {
    const user = userEvent.setup()
    renderInviteAll(
      vi.fn(async () => listed),
      { activeCount: 1 },
    )

    await user.click(screen.getByRole('button', { name: copy.open }))

    // The dialog's code loads on first open.
    const dialog = await screen.findByRole('alertdialog', { name: copy.dialogTitle })
    expect([...dialog.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Only the 2 without an invite',
      'Replace it too',
      copy.cancel,
    ])
  })

  it('disables both choices while either is running', async () => {
    const user = userEvent.setup()
    const never = () => new Promise<CreateAllState>(() => {})
    renderInviteAll(vi.fn(never), { activeCount: 1 })

    await user.click(screen.getByRole('button', { name: copy.open }))
    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Only the 2 without an invite' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replace it too' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    expect(screen.getByRole('button', { name: copy.creating })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
