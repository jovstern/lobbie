/**
 * Tags for the building-wide reads kept with `'use cache'`. Every write to a building's rows
 * (its settings, fee rates, payments, expenses or adjustments) calls
 * `updateTag(buildingTag(id))` in its Server Action; the narrower tags let a write refresh
 * less where it can.
 */
export const buildingTag = (buildingId: string) => `building:${buildingId}`
export const feesTag = (buildingId: string) => `building:${buildingId}:fees`
export const balanceTag = (buildingId: string) => `building:${buildingId}:balance`
