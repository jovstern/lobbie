import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { BuildingFormState } from '@/app/lib/actions/buildings'
import BuildingForm from '@/app/ui/admin/building-form'
import en from '@/messages/en.json'

const copy = en.BuildingForm
const saved = {
  name: 'Pomegranate 12',
  address: 'Pomegranate 12, Ramat Gan',
  quorumPercent: '50',
  billingStartMonth: '2025-11',
}
const moved = { ...saved, billingStartMonth: '2026-01' }

function renderForm(
  action: (state: BuildingFormState, formData: FormData) => Promise<BuildingFormState>,
  confirmedAction = vi.fn(async (): Promise<BuildingFormState> => ({
    values: moved,
    message: null,
    savedAt: 1,
  })),
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ BuildingForm: copy }}>
      <BuildingForm action={action} confirmedAction={confirmedAction} saved={saved} />
    </NextIntlClientProvider>,
  )
  return confirmedAction
}

describe('BuildingForm', () => {
  it('shows the pending state while saving, then announces "Saved"', async () => {
    const user = userEvent.setup()
    let finish: (state: BuildingFormState) => void = () => {}
    renderForm(() => new Promise((resolve) => (finish = resolve)))

    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(await screen.findByRole('button', { name: copy.saving })).toBeDisabled()

    finish({ values: saved, message: null, savedAt: 1 })
    expect(await screen.findByText(copy.saved)).toBeVisible()
  })

  it('asks before changing the billing month, focusing the warning, and saves on confirm', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async (): Promise<BuildingFormState> => ({
      values: moved,
      message: null,
      confirmBillingChange: { from: '2025-11', to: '2026-01' },
    }))
    const confirmedAction = renderForm(action)

    await user.click(screen.getByRole('button', { name: copy.save }))

    const warning = await screen.findByText(copy.confirmTitle)
    expect(warning.parentElement).toHaveFocus()
    expect(warning.parentElement).toHaveTextContent(
      'Billing would start in January 2026 instead of November 2025.',
    )
    expect(screen.getByLabelText(copy.billingStartMonth)).toHaveValue('2026-01')
    expect(confirmedAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: copy.saveAnyway }))

    expect(confirmedAction).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(copy.saved)).toBeVisible()
    expect(screen.queryByText(copy.confirmTitle)).not.toBeInTheDocument()
  })
})
