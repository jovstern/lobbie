import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArrivalHeading from '@/app/ui/admin/arrival-heading'

describe('ArrivalHeading', () => {
  it('takes focus when an apartment link (here a button) opened it', () => {
    const { rerender } = render(
      <button type="button" data-select-apartment>
        Apartment 4
      </button>,
    )
    screen.getByRole('button', { name: 'Apartment 4' }).focus()

    rerender(
      <>
        <button type="button" data-select-apartment>
          Apartment 4
        </button>
        <ArrivalHeading id="open-apartment-title">Apartment 4</ArrivalHeading>
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Apartment 4' })).toHaveFocus()
  })

  it('leaves focus alone on a page loaded with the apartment open', () => {
    render(<ArrivalHeading id="open-apartment-title">Apartment 4</ArrivalHeading>)

    expect(document.body).toHaveFocus()
  })

  it('leaves focus alone when another control, such as a year, changed the page', () => {
    const { rerender } = render(<button type="button">2025</button>)
    screen.getByRole('button', { name: '2025' }).focus()

    rerender(
      <>
        <button type="button">2025</button>
        <ArrivalHeading id="open-apartment-title">Apartment 4</ArrivalHeading>
      </>,
    )

    expect(screen.getByRole('button', { name: '2025' })).toHaveFocus()
  })
})
