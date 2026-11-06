import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { CreateInviteState } from '@/app/lib/actions/invites'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import InviteControls from '@/app/ui/admin/invite-controls'
import en from '@/messages/en.json'

const copy = en.InviteAdminClient
const created: CreateInviteState = {
  message: null,
  created: {
    inviteId: 'invite-1',
    apartmentId: 'apartment-7',
    apartmentNumber: '7',
    code: 'ABCDE-23456',
    link: 'https://lobbie.example/join/ABCDE23456',
  },
}

function controls(activeInviteId: string | null, createAction = vi.fn(async () => created)) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ InviteAdminClient: copy, CopyButton: en.CopyButton }}
    >
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Apartment 7
          </h1>
        }
      >
        <InviteControls
          createAction={createAction}
          replaceAction={vi.fn(async () => created)}
          number="7"
          activeInviteId={activeInviteId}
        />
      </AdminAnnouncer>
    </NextIntlClientProvider>
  )
}

describe('InviteControls', () => {
  it('shows the new link once, focused, and hides it when it stops being the active invite', async () => {
    const user = userEvent.setup()
    const createAction = vi.fn(async () => created)
    const { rerender } = render(controls(null, createAction))

    await user.click(screen.getByRole('button', { name: copy.create }))
    // The server's refresh: the new invite is now the apartment's active one.
    rerender(controls('invite-1', createAction))

    const fresh = await screen.findByRole('group', { name: copy.newTitle })
    expect(fresh).toHaveFocus()
    expect(fresh).toHaveTextContent('https://lobbie.example/join/ABCDE23456')
    expect(fresh).toHaveTextContent('ABCDE-23456')
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(copy.created)

    rerender(controls(null, createAction))
    expect(screen.queryByRole('group', { name: copy.newTitle })).not.toBeInTheDocument()
  })

  it('asks before replacing an active invite', async () => {
    const user = userEvent.setup()
    render(controls('invite-0'))

    await user.click(screen.getByRole('button', { name: copy.replace }))

    expect(
      screen.getByRole('alertdialog', { name: 'Replace the invite for apartment 7?' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: copy.cancel })).toHaveFocus()
  })
})
