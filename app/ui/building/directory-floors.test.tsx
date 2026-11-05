import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { DirectoryFloor } from '@/app/lib/definitions'
import DirectoryFloors from '@/app/ui/building/directory-floors'
import en from '@/messages/en.json'

const floors: DirectoryFloor[] = [
  {
    floor: 0,
    apartments: [
      {
        id: 'a1',
        number: '1',
        residents: [
          {
            userId: 'u1',
            name: 'Ana Levi',
            isOwner: true,
            phone: '+972505550101',
            email: 'ana@example.com',
          },
          { userId: 'u2', name: 'Ben Cohen', isOwner: false, phone: null, email: null },
        ],
      },
    ],
  },
  {
    floor: 1,
    apartments: [
      {
        id: 'a2',
        number: '2',
        residents: [{ userId: 'u3', name: 'Dan Mor', isOwner: false, phone: null, email: null }],
      },
      { id: 'a5', number: '5', residents: [] },
      {
        id: 'a10',
        number: '10',
        residents: [{ userId: 'u4', name: 'Eli Bar', isOwner: true, phone: null, email: null }],
      },
    ],
  },
]

function renderFloors(myApartmentIds: string[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ Directory: en.Directory, Contact: en.Contact }}>
      <DirectoryFloors floors={floors} myApartmentIds={myApartmentIds} />
    </NextIntlClientProvider>,
  )
}

describe('DirectoryFloors', () => {
  it('shows a section per floor with its apartments in order, each with its residents', () => {
    renderFloors()

    const ground = screen.getByRole('region', { name: 'Ground floor' })
    const first = screen.getByRole('region', { name: 'Floor 1' })
    expect(
      within(first)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Apartment 2', 'Apartment 5', 'Apartment 10'])
    expect(first).toHaveTextContent(en.Directory.notJoined)
    expect(within(ground).getByRole('heading', { level: 3 })).toHaveTextContent('Apartment 1')
    expect(ground).toHaveTextContent('Ana Levi')
    expect(ground).toHaveTextContent(en.Directory.owner)
    expect(ground).toHaveTextContent('Ben Cohen')
    expect(ground).toHaveTextContent(en.Directory.tenant)
  })

  it('marks the member’s own apartment, and only it', () => {
    renderFloors(['a10'])

    expect(
      screen.getByRole('heading', { level: 3, name: 'Apartment 10, Your apartment' }),
    ).toBeVisible()
    expect(screen.getAllByText(en.Directory.yourApartment)).toHaveLength(1)
  })

  it('links a shared phone (shown as Israelis write it) and email, left to right, and nothing for a hidden one', () => {
    renderFloors()

    const call = screen.getByRole('link', { name: 'Phone: 050-555-0101' })
    expect(call).toHaveAttribute('href', 'tel:+972505550101')
    expect(call.querySelector('bdi')).toHaveAttribute('dir', 'ltr')
    const write = screen.getByRole('link', { name: 'Email: ana@example.com' })
    expect(write).toHaveAttribute('href', 'mailto:ana@example.com')
    expect(write.querySelector('bdi')).toHaveAttribute('dir', 'ltr')
    // Ana's two links are the only ones: no one else shared a contact.
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
