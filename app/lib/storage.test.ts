import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { maxReceiptBytes } from '@/app/lib/utils/receipt-file'
import { uploadsRoot } from '@/app/lib/utils/uploads-root'
import { checkFile, createStorage, localDriver, type Storage } from './storage'

const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])

function checked(bytes: Uint8Array) {
  const check = checkFile(bytes)
  if (!check.ok) throw new Error(`refused: ${check.reason}`)
  return check.file
}

let root: string
let storage: Storage

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lobbie-storage-'))
  storage = createStorage(localDriver(root))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('checkFile', () => {
  it('takes a receipt by its bytes', () => {
    const check = checkFile(pdf)
    expect(check.ok && check.file.type).toBe('application/pdf')
  })

  it('refuses an empty file, one over 4 MB, and one that is not a receipt type', () => {
    expect(checkFile(new Uint8Array())).toEqual({ ok: false, reason: 'empty' })
    const tooLarge = new Uint8Array(maxReceiptBytes + 1)
    tooLarge.set(pdf)
    expect(checkFile(tooLarge)).toEqual({ ok: false, reason: 'tooLarge' })
    // An HTML page named receipt.pdf: the name and the declared type are never asked.
    const disguised = new TextEncoder().encode('<html><script>alert(1)</script></html>')
    expect(checkFile(disguised)).toEqual({ ok: false, reason: 'type' })
  })

  it('takes exactly 4 MB', () => {
    const atLimit = new Uint8Array(maxReceiptBytes)
    atLimit.set(pdf)
    expect(checkFile(atLimit).ok).toBe(true)
  })
})

describe('storage', () => {
  it('puts a file under a fresh key, gets it back with its type, and removes it', async () => {
    const key = await storage.put(checked(pdf))

    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/)
    expect(await storage.get(key)).toEqual({ bytes: pdf, contentType: 'application/pdf' })
    expect(await readdir(root)).toEqual([key])

    await storage.remove(key)
    expect(await storage.get(key)).toBeNull()
    expect(await readdir(root)).toEqual([])
  })

  it('gives every file its own key', async () => {
    const first = await storage.put(checked(png))
    const second = await storage.put(checked(png))

    expect(first).not.toBe(second)
    expect((await storage.get(first))?.contentType).toBe('image/png')
  })

  it('has nothing for a key it never gave, and never reads outside its folder', async () => {
    expect(await storage.get('0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.pdf')).toBeNull()
    for (const key of ['../storage.test.ts', `../${path.basename(root)}`, '', 'x.pdf']) {
      expect(await storage.get(key)).toBeNull()
    }
  })

  it('removing a file that is gone is not an error; a malformed key is', async () => {
    await expect(storage.remove('0b4c1a3e-7d2f-4e8a-9b6c-1f2e3d4c5b6a.png')).resolves.toBe(
      undefined,
    )
    await expect(storage.remove('../x')).rejects.toThrow('Not a receipt key')
  })

  it('creates its folder on the first put', async () => {
    const nested = createStorage(localDriver(path.join(root, 'a', 'b')))
    const key = await nested.put(checked(png))
    expect(await readFile(path.join(root, 'a', 'b', key))).toEqual(Buffer.from(png))
  })
})

describe('uploadsRoot', () => {
  it("gives each database its own folder under .data/uploads, so tests never mix with dev's files", () => {
    const dev = uploadsRoot('postgres://dev.example/db', '/app')
    const test = uploadsRoot('postgres://test.example/db', '/app')

    expect(path.dirname(dev)).toBe(path.join('/app', '.data', 'uploads'))
    expect(path.dirname(test)).toBe(path.join('/app', '.data', 'uploads'))
    expect(dev).not.toBe(test)
    expect(uploadsRoot('postgres://dev.example/db', '/app')).toBe(dev)
    // The folder's name never shows the connection string.
    expect(path.basename(dev)).toMatch(/^[0-9a-f]{16}$/)
  })
})
