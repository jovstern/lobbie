/** A receipt's largest size: Vercel refuses a request body over 4.5 MB (spec §3). */
export const maxReceiptBytes = 4 * 1024 * 1024

/** The receipt types Lobbie keeps (spec §3). */
export type ReceiptType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

/** The extension each type's keys end in. */
const extensionOf: { [Type in ReceiptType]: string } = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const receiptTypes: readonly ReceiptType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte)

const codes = (text: string) => [...text].map((char) => char.charCodeAt(0))

// The files' own first bytes. A PDF's header is taken only at the very start, though readers
// accept it further in: anything before it could be another format's.
const jpeg = [0xff, 0xd8, 0xff]
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const riff = codes('RIFF')
const webp = codes('WEBP')
const pdf = codes('%PDF-')

/**
 * The receipt's type, read from its bytes: never from its name or the type the browser
 * declared, which the sender chooses. Null for anything else (HTML, SVG, a program, HEIC).
 */
export function sniffReceiptType(bytes: Uint8Array): ReceiptType | null {
  if (startsWith(bytes, jpeg)) return 'image/jpeg'
  if (startsWith(bytes, png)) return 'image/png'
  // RIFF, the chunk's 4-byte size, then the form type.
  if (startsWith(bytes, riff) && startsWith(bytes, webp, 8)) return 'image/webp'
  if (startsWith(bytes, pdf)) return 'application/pdf'
  return null
}

// A v4 UUID (as `crypto.randomUUID` makes it, lower case) and one of the extensions: nothing
// else, so a key can never name a path outside the store.
const keyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/

/** A new key for a receipt of `type`: random, never from what the sender sent. */
export function receiptKey(type: ReceiptType): string {
  return `${crypto.randomUUID()}.${extensionOf[type]}`
}

/** Whether `key` has the shape `receiptKey` generates. */
export function isReceiptKey(key: string): boolean {
  return keyPattern.test(key)
}

/** The type a key was generated for, or null when it is not a receipt key. */
export function contentTypeOfKey(key: string): ReceiptType | null {
  const extension = keyPattern.exec(key)?.[1]
  return receiptTypes.find((type) => extensionOf[type] === extension) ?? null
}
