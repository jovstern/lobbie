import type { DirectoryFloor, DirectoryResident } from '@/app/lib/definitions'

/** One row of the directory query: an apartment, with one of its residents or none. */
export type DirectoryRow = {
  apartmentId: string
  number: string
  floor: number
  resident: DirectoryResident | null
}

/**
 * The directory's rows (already by floor, apartment and name) as floors of apartments, each
 * group in the order its first row came. An apartment whose row has no resident has none.
 */
export function groupByFloor(rows: DirectoryRow[]): DirectoryFloor[] {
  const floors: DirectoryFloor[] = []
  for (const { apartmentId, number, floor, resident } of rows) {
    let current = floors.at(-1)
    if (current?.floor !== floor) {
      current = { floor, apartments: [] }
      floors.push(current)
    }
    let apartment = current.apartments.at(-1)
    if (apartment?.id !== apartmentId) {
      apartment = { id: apartmentId, number, residents: [] }
      current.apartments.push(apartment)
    }
    if (resident) apartment.residents.push(resident)
  }
  return floors
}

/** A `tel:` link for a phone number as people type it: digits, and a leading `+`. */
export function telHref(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`
}
