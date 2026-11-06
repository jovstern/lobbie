import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { RemoveResidentState } from '@/app/lib/actions/residents'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import RemoveResidentDialog from '@/app/ui/admin/remove-resident-dialog'
import en from '@/messages/en.json'

const copy = en.ResidentsClient

function renderDialog(
  leavesBuilding: boolean,
  action = vi.fn(async (): Promise<RemoveResidentState> => ({ removed: true, message: null })),
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ ResidentsClient: copy }}>
      <AdminAnnouncer
        headingId="heading"
        header={
          <h1 id="heading" tabIndex={-1}>
            Apartment 7
          </h1>
        }
      >
        <RemoveResidentDialog
          action={action}
          name="Ana"
          number="7"
          leavesBuilding={leavesBuilding}
        />
      </AdminAnnouncer>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'Remove Ana from apartment 7' })
}

describe('RemoveResidentDialog', () => {
  it('warns that their last apartment takes them out of the building', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(true))

    const dialog = screen.getByRole('alertdialog', { name: 'Remove Ana from apartment 7?' })
    expect(dialog).toHaveAccessibleDescription(
      'Ana leaves the building too: they’ll lose access. Their account remains, and a new invite brings them back.',
    )
    expect(screen.getByRole('button', { name: copy.cancel })).toHaveFocus()
  })

  it('says they stay in the building when they live elsewhere in it', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(false))

    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Ana stays in the building, in their other apartments.',
    )
  })

  it('removes, announces it and moves focus to the heading', async () => {
    const user = userEvent.setup()
    await user.click(renderDialog(false))

    await user.click(screen.getByRole('button', { name: copy.confirm }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Ana no longer lives in apartment 7')
    expect(screen.getByRole('heading', { name: 'Apartment 7' })).toHaveFocus()
  })

  it('shows a refusal in the dialog, and not on the next opening', async () => {
    const user = userEvent.setup()
    const trigger = renderDialog(
      true,
      vi.fn(async () => ({ message: en.ResidentErrors.lastAdmin })),
    )
    await user.click(trigger)

    await user.click(screen.getByRole('button', { name: copy.confirm }))

    expect(await screen.findByText(en.ResidentErrors.lastAdmin)).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(trigger)
    expect(screen.queryByText(en.ResidentErrors.lastAdmin)).not.toBeInTheDocument()
  })
})
