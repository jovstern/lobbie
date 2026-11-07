import { describe, expect, it } from 'vitest'
import {
  contentTypeOfKey,
  isReceiptKey,
  maxReceiptBytes,
  receiptKey,
  sniffReceiptType,
} from './receipt-file'

const bytes = (...values: number[]) => new Uint8Array(values)
const ascii = (text: string) => new TextEncoder().encode(text)
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe('sniffReceiptType', () => {
  it.each([
    ['a JPEG', bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10), 'image/jpeg'],
    ['a PNG', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00), 'image/png'],
    ['a WebP', concat(ascii('RIFF'), bytes(0x24, 0, 0, 0), ascii('WEBPVP8 ')), 'image/webp'],
    ['a PDF', ascii('%PDF-1.7\n%âãÏÓ'), 'application/pdf'],
  ] as const)('knows %s by its first bytes', (_, file, type) => {
    expect(sniffReceiptType(file)).toBe(type)
  })

  it.each([
    ['nothing', bytes()],
    ['an HTML page', ascii('<!doctype html><script>alert(1)</script>')],
    ['an SVG', ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['a Windows program', concat(ascii('MZ'), bytes(0x90, 0x00, 0x03))],
    ['a GIF', ascii('GIF89a')],
    ['a HEIC photo', concat(bytes(0, 0, 0, 0x18), ascii('ftypheic'))],
    ['a RIFF that is not WebP (a WAV)', concat(ascii('RIFF'), bytes(0x24, 0, 0, 0), ascii('WAVE'))],
    ['a truncated PNG signature', bytes(0x89, 0x50, 0x4e, 0x47)],
    ['a PDF header that does not start the file', ascii(' %PDF-1.7')],
    ['two bytes of a JPEG', bytes(0xff, 0xd8)],
  ])('refuses %s', (_, file) => {
    expect(sniffReceiptType(file)).toBeNull()
  })
})

describe('receipt keys', () => {
  it('names a fresh random key after the type, and reads the type back from it', () => {
    const pdf = receiptKey('application/pdf')
    const png = receiptKey('image/png')

    expect(pdf).toMatch(/^[0-9a-f-]{36}\.pdf$/)
    expect(png).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(receiptKey('image/jpeg')).not.toBe(receiptKey('image/jpeg'))
    expect(contentTypeOfKey(pdf)).toBe('application/pdf')
    expect(contentTypeOfKey(png)).toBe('image/png')
    expect(contentTypeOfKey(receiptKey('image/jpeg'))).toBe('image/jpeg')
    expect(contentTypeOfKey(receiptKey('image/webp'))).toBe('image/webp')
  })

  it('accepts only the shape it generates', () => {
    expect(isReceiptKey(receiptKey('image/webp'))).toBe(true)
    for (const key of [
      '',
      '../.env.local',
      '..%2F..%2Fetc%2Fpasswd',
      '0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a',
      '0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.html',
      '0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.pdf/../x',
      '0B4C1A3E-7D2F-4E8A-9B6C-1F2E3D4C5B6A.pdf',
      'sub/0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.pdf',
      '0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.pdf\n',
    ]) {
      expect(isReceiptKey(key), key).toBe(false)
      expect(contentTypeOfKey(key), key).toBeNull()
    }
  })

  it('allows 4 MB', () => {
    expect(maxReceiptBytes).toBe(4 * 1024 * 1024)
  })
})
