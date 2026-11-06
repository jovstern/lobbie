import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Messages are precompiled at build time (docs/adr/0002-next-intl-precompile.md), and
// precompiled messages have no `t.raw`: a call would fail only at runtime.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

describe('translations', () => {
  it('never read a message raw', () => {
    const offenders = ['app', 'i18n']
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => /\bt\w*\.raw\(/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
