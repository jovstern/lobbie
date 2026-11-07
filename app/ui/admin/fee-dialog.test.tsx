import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { FeeFormState } from '@/app/lib/actions/fees'
import FeeDialog, { type FeeTarget } from '@/app/ui/admin/fee-dialog'
import type { FeeAction } from '@/app/ui/admin/fee-form'
import en from '@/messages/en.json'

const copy = en.FeeForm
const choices = [
  { id: '00000000-0000-4000-8000-000000000001', number: '1' },
  { id: '00000000-0000-4000-8000-000000000010', number: '10' },
]

function renderDialog(
  target: FeeTarget,
  action: FeeAction = vi.fn(async (): Promise<FeeFormState> => ({})),
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ FeeForm: copy, Common: en.Common }}>
      <FeeDialog action={action} target={target} defaultMonth="2026-12" />
    </NextIntlClientProvider>,
  )
}

describe('FeeDialog', () => {
  it("opens the building's fee with focus on the amount and next month filled in", async () => {
    const user = userEvent.setup()
    renderDialog({ kind: 'building' })

    await user.click(screen.getByRole('button', { name: copy.openBuilding }))
    // The dialog's code loads on first open.
    const dialog = await screen.findByRole('dialog', { name: copy.buildingTitle })

    expect(dialog).toHaveAccessibleDescription(copy.buildingDescription)
    expect(screen.getByLabelText(copy.amount)).toHaveFocus()
    expect(screen.getByLabelText(copy.effectiveFrom)).toHaveValue('2026-12')
    expect(screen.queryByLabelText(copy.apartment)).not.toBeInTheDocument()
  })

  it('offers no month before the earliest one the server accepts', async () => {
    const user = userEvent.setup()
    render(
      <NextIntlClientProvider locale="en" messages={{ FeeForm: copy, Common: en.Common }}>
        <FeeDialog
          action={vi.fn(async (): Promise<FeeFormState> => ({}))}
          target={{ kind: 'building' }}
          defaultMonth="2026-12"
          minMonth="2026-11"
        />
      </NextIntlClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: copy.openBuilding }))
    await screen.findByRole('dialog')

    expect(screen.getByLabelText(copy.effectiveFrom)).toHaveAttribute('min', '2026-11')
  })

  it('asks for the apartment first when the form chooses one', async () => {
    const user = userEvent.setup()
    renderDialog({ kind: 'chosen', choices })

    await user.click(screen.getByRole('button', { name: copy.openApartment }))
    await screen.findByRole('dialog', { name: copy.apartmentTitle })

    const select = screen.getByLabelText(copy.apartment)
    expect(select).toHaveFocus()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      copy.chooseApartment,
      'Apartment 1',
      'Apartment 10',
    ])
  })

  it("names one apartment's own fee in its title", async () => {
    const user = userEvent.setup()
    renderDialog({ kind: 'apartment', number: '7' })

    await user.click(screen.getByRole('button', { name: copy.openThisApartment }))

    expect(
      await screen.findByRole('dialog', { name: "Apartment 7's own fee" }),
    ).toHaveAccessibleDescription(copy.apartmentDescription)
  })

  it('closes on save, returns focus to the button and says what was set', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<FeeFormState> => ({
      message: null,
      saved: { amountAgorot: 41_250, effectiveFrom: '2027-01', apartmentNumber: '10' },
    }))
    renderDialog({ kind: 'chosen', choices }, action)
    const trigger = screen.getByRole('button', { name: copy.openApartment })

    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.selectOptions(screen.getByLabelText(copy.apartment), 'Apartment 10')
    await user.type(screen.getByLabelText(copy.amount), '412.50')
    await user.click(screen.getByRole('button', { name: copy.submit }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Apartment 10's fee set: ₪\s?412\.50 from January 2027$/,
    )
    const sent = action.mock.calls[0] as unknown as [FeeFormState, FormData]
    expect(Object.fromEntries(sent[1])).toEqual({
      apartmentId: choices[1].id,
      amount: '412.50',
      effectiveFrom: '2026-12',
    })
  })

  it('keeps what was sent and focuses the first field with an error', async () => {
    const user = userEvent.setup()
    const failed: FeeFormState = {
      values: { apartmentId: choices[0].id, amount: '400', effectiveFrom: '2020-01' },
      errors: { effectiveFrom: [en.FeeErrors.effectiveFrom] },
      message: null,
    }
    renderDialog(
      { kind: 'chosen', choices },
      vi.fn(async () => failed),
    )

    await user.click(screen.getByRole('button', { name: copy.openApartment }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: copy.submit }))

    const month = screen.getByLabelText(copy.effectiveFrom)
    expect(month).toHaveFocus()
    expect(month).toHaveAccessibleDescription(
      `${copy.effectiveFromHint} ${en.FeeErrors.effectiveFrom}`,
    )
    expect(screen.getByLabelText(copy.apartment)).toHaveValue(choices[0].id)
    expect(screen.getByLabelText(copy.amount)).toHaveValue('400')
  })
})
