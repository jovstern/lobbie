// Israeli numbers without their trunk 0: mobile (5X) and 07X numbers have 9 digits, and
// landlines (02, 03, 04, 08, 09) have 8.
const nationalNumber = /^(?:[57]\d{8}|[2-489]\d{7})$/
// Digits, with spaces and dashes between them, and a + only at the start.
const typedShape = /^\+?\d[\d -]*$/

/**
 * A phone number as people type it (`050-555-0101`, `+972 50 555 0101`) in E.164
 * (`+972505550101`), or null when it is not an Israeli number.
 */
export function normalizePhone(typed: string): string | null {
  const trimmed = typed.trim()
  if (!typedShape.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')

  let national: string
  if (trimmed.startsWith('+')) {
    if (!digits.startsWith('972')) return null
    // Some keep the trunk 0 after the country code: +972 050…
    national = digits.slice(3).replace(/^0/, '')
  } else {
    if (!digits.startsWith('0')) return null
    national = digits.slice(1)
  }
  return nationalNumber.test(national) ? `+972${national}` : null
}

/** A saved number as Israelis write it (`050-555-0101`), or as saved when it is not one. */
export function formatPhone(saved: string): string {
  const e164 = normalizePhone(saved)
  if (!e164) return saved
  const local = `0${e164.slice(4)}`
  // Mobile and 07X: a three-digit prefix; landlines: two.
  const prefixLength = local.length === 10 ? 3 : 2
  const rest = local.slice(prefixLength)
  return `${local.slice(0, prefixLength)}-${rest.slice(0, 3)}-${rest.slice(3)}`
}
