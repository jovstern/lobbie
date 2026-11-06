import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import RemovePersonDialog from '@/app/ui/admin/remove-person-dialog'
import en from '@/messages/en.json'

const copy = en.PersonRemove

async function openDialog(isSelf: boolean) {
  const user = userEvent.setup()
  render(
    <NextIntlClientProvider locale="en" messages={{ PersonRemove: copy }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            People
          </h1>
        }
      >
        <RemovePersonDialog
          action={vi.fn(async () => ({ removed: true, message: null }))}
          name="Ana"
          isSelf={isSelf}
        />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Remove Ana from the building' }))
  // The dialog's code loads on first open.
  await screen.findByRole('alertdialog')
  return screen.getByRole('alertdialog', { name: 'Remove Ana from the building?' })
}

describe('RemovePersonDialog', () => {
  it('says what goes and what stays', async () => {
    expect(await openDialog(false)).toHaveAccessibleDescription(
      'This removes Ana from all their apartments and from the building, and they lose access to it at once. Their account remains: a new invite brings them back.',
    )
  })

  it('tells the admin when they are removing themselves', async () => {
    expect(await openDialog(true)).toHaveAccessibleDescription(copy.selfDescription)
  })
})
