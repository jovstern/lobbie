import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireEnv } from '@/app/lib/env'
import {
  contentTypeOfKey,
  isReceiptKey,
  maxReceiptBytes,
  receiptKey,
  sniffReceiptType,
  type ReceiptType,
} from '@/app/lib/utils/receipt-file'
import { uploadsRoot } from '@/app/lib/utils/uploads-root'

/**
 * Where a file's bytes live, by key. The local driver now; at launch (M7) a Vercel Blob driver
 * takes its place behind the same three calls, and nothing above it changes. Keys reach a
 * driver only once checked; files are served only through the authorized Route Handler.
 */
export type StorageDriver = {
  write: (key: string, bytes: Uint8Array, contentType: ReceiptType) => Promise<void>
  /** Null when there is no such file. Its own copy of the bytes, so a Response can take it. */
  read: (key: string) => Promise<Uint8Array<ArrayBuffer> | null>
  /** Nothing to do when there is no such file. */
  delete: (key: string) => Promise<void>
}

function assertKey(key: string) {
  if (!isReceiptKey(key)) throw new Error('Not a receipt key')
}

const isMissing = (err: unknown) => err instanceof Error && 'code' in err && err.code === 'ENOENT'

/** Files on the local disk, one per key, in `root`. */
export function localDriver(root: string): StorageDriver {
  // A key is a UUID and an extension (checked again here), so the path stays inside `root`.
  const fileOf = (key: string) => {
    assertKey(key)
    return path.join(root, key)
  }
  return {
    async write(key, bytes) {
      const file = fileOf(key)
      await mkdir(root, { recursive: true })
      // `wx`: a key is new, so a file already there is never overwritten.
      await writeFile(file, bytes, { flag: 'wx' })
    },
    async read(key) {
      try {
        return new Uint8Array(await readFile(fileOf(key)))
      } catch (err) {
        if (isMissing(err)) return null
        throw err
      }
    },
    async delete(key) {
      await rm(fileOf(key), { force: true })
    },
  }
}

declare const checkedFile: unique symbol

/** A file `checkFile` accepted, with the type its bytes are: only such a file can be put. */
export type CheckedFile = {
  readonly bytes: Uint8Array
  readonly type: ReceiptType
  readonly [checkedFile]: true
}

export type FileRefusal = 'empty' | 'tooLarge' | 'type'

/**
 * Whether a file may be kept as a receipt (spec §3): not empty, at most 4 MB, and a JPEG, PNG,
 * WebP or PDF by its own bytes. Its name and the type the browser declared are never asked.
 */
export function checkFile(
  bytes: Uint8Array,
): { ok: true; file: CheckedFile } | { ok: false; reason: FileRefusal } {
  if (bytes.length === 0) return { ok: false, reason: 'empty' }
  if (bytes.length > maxReceiptBytes) return { ok: false, reason: 'tooLarge' }
  const type = sniffReceiptType(bytes)
  if (!type) return { ok: false, reason: 'type' }
  // The brand exists only in types: it marks the file as having passed the checks above.
  return { ok: true, file: { bytes, type } as CheckedFile }
}

export type StoredFile = { bytes: Uint8Array<ArrayBuffer>; contentType: ReceiptType }

export type Storage = {
  /** Keeps a checked file under a new random key, and returns the key. */
  put: (file: CheckedFile) => Promise<string>
  /** The file and its type, or null for a key that is malformed or has no file. */
  get: (key: string) => Promise<StoredFile | null>
  /** Removes a file; one already gone is fine. A malformed key throws. */
  remove: (key: string) => Promise<void>
}

/** Storage by key over a driver: keys are generated here, never taken from a request. */
export function createStorage(driver: StorageDriver): Storage {
  return {
    async put(file) {
      const key = receiptKey(file.type)
      await driver.write(key, file.bytes, file.type)
      return key
    },
    async get(key) {
      const contentType = contentTypeOfKey(key)
      if (!contentType) return null
      const bytes = await driver.read(key)
      return bytes ? { bytes, contentType } : null
    },
    async remove(key) {
      assertKey(key)
      await driver.delete(key)
    },
  }
}

let appStorage: Storage | undefined

// Created on first use, so importing this module reads no environment (at build time, say).
function storage(): Storage {
  appStorage ??= createStorage(localDriver(uploadsRoot(requireEnv('DATABASE_URL'))))
  return appStorage
}

/** The app's storage: `put`, `get` and `remove` by key (spec §4, Files). */
export const put: Storage['put'] = (file) => storage().put(file)
export const get: Storage['get'] = (key) => storage().get(key)
export const remove: Storage['remove'] = (key) => storage().remove(key)
