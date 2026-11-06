import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { RoleFormState } from '@/app/lib/actions/members'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import PersonRoleDialog from '@/app/ui/admin/person-role-dialog'
import type { RoleAction, RoleValues } from '@/app/ui/admin/person-role-form'
import en from '@/messages/en.json'

const copy = en.PersonRole

function renderDialog(
  action: RoleAction = vi.fn(async () => ({})),
  saved: RoleValues = { role: 'committee', committeeTitle: 'Chair' },
  isSelf = false,
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ PersonRole: copy, Roles: en.Roles }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            People
          </h1>
        }
      >
        <PersonRoleDialog action={action} name="Ana" isSelf={isSelf} saved={saved} />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'Change role of Ana' })
}

describe('PersonRoleDialog', () => {
  it('opens a labelled dialog with focus on the saved role, and the title filled in', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog())

    const dialog = screen.getByRole('dialog', { name: 'Role of Ana' })
    expect(dialog).toHaveAccessibleDescription(copy.description)
    const committee = screen.getByRole('radio', { name: 'Committee' })
    expect(committee).toHaveFocus()
    expect(committee).toHaveAccessibleDescription(copy.committeeHint)
    expect(screen.getByLabelText(copy.committeeTitle)).toHaveValue('Chair')
  })

  it('closes with Escape and returns focus to the button', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog()
    await user.click(trigger)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('hides the title for a resident, who has none', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog())

    await user.click(screen.getByRole('radio', { name: 'Resident' }))

    expect(screen.queryByLabelText(copy.committeeTitle)).not.toBeInTheDocument()
  })

  it('shows a refusal in the dialog and keeps the choice', async () => {
    const user = userEvent.setup()
    const refused: RoleFormState = {
      values: { role: 'resident', committeeTitle: '' },
      message: en.MemberErrors.lastAdminDemote,
    }
    await user.click(
      renderDialog(
        vi.fn(async () => refused),
        { role: 'admin', committeeTitle: '' },
      ),
    )
    await user.click(screen.getByRole('radio', { name: 'Resident' }))

    await user.click(screen.getByRole('button', { name: copy.save }))

    expect(await screen.findByText(en.MemberErrors.lastAdminDemote)).toBeVisible()
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Resident' })).toBeChecked()
  })

  it('saves, closes, announces it and returns focus to the button', async () => {
    const user = userEvent.setup()
    const action = vi.fn<RoleAction>(async () => ({ saved: { role: 'admin' }, message: null }))
    const trigger = renderDialog(action)
    await user.click(trigger)
    await user.click(screen.getByRole('radio', { name: 'Admin' }))
    await user.clear(screen.getByLabelText(copy.committeeTitle))
    await user.type(screen.getByLabelText(copy.committeeTitle), 'Treasurer')

    await user.click(screen.getByRole('button', { name: copy.save }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const sent = action.mock.calls[0][1]
    expect(sent.get('role')).toBe('admin')
    expect(sent.get('committeeTitle')).toBe('Treasurer')
    expect(screen.getByRole('status')).toHaveTextContent('Ana’s role is saved')
    expect(trigger).toHaveFocus()
  })

  it('warns an admin who is about to give up the role themselves', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(undefined, { role: 'admin', committeeTitle: '' }, true))
    expect(screen.queryByText(copy.selfDemoteWarning)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Committee' }))

    expect(screen.getByText(copy.selfDemoteWarning)).toBeVisible()
  })

  it('does not warn when the admin changes someone else', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(undefined, { role: 'admin', committeeTitle: '' }))

    await user.click(screen.getByRole('radio', { name: 'Committee' }))

    expect(screen.queryByText(copy.selfDemoteWarning)).not.toBeInTheDocument()
  })
})
