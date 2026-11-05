import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/app/lib/utils/contrast'
import { palette, type ColorToken, type Theme } from '@/app/ui/tokens'

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#000000', 21],
    ['#777777', '#777777', 1],
    ['#767676', '#FFFFFF', 4.54],
    ['#c2562f', '#ffffff', 4.5],
  ])('%s on %s is %d:1', (foreground, background, expected) => {
    expect(contrastRatio(foreground, background)).toBeCloseTo(expected, 2)
  })

  it.each(['#FFF', 'FFFFFF', '#GGGGGG', ''])('rejects %j', (color) => {
    expect(() => contrastRatio(color, '#FFFFFF')).toThrow(/hex colour/)
  })
})

const textTokens: ColorToken[] = ['text', 'text-muted', 'accent', 'success', 'warning', 'danger']
const surfaces: ColorToken[] = ['surface', 'surface-raised']
const themes: Theme[] = ['light', 'dark']

describe('design tokens meet WCAG AA in both themes', () => {
  const textPairs = themes.flatMap((theme) =>
    surfaces.flatMap((surface) => textTokens.map((text) => [theme, text, surface] as const)),
  )

  it.each(textPairs)('%s: %s on %s is at least 4.5:1', (theme, text, surface) => {
    expect(contrastRatio(palette[theme][text], palette[theme][surface])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(themes)('%s: on-accent on danger (the danger button) is at least 4.5:1', (theme) => {
    expect(
      contrastRatio(palette[theme]['on-accent'], palette[theme].danger),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(themes)('%s: on-accent on accent is at least 4.5:1', (theme) => {
    expect(
      contrastRatio(palette[theme]['on-accent'], palette[theme].accent),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(themes.flatMap((theme) => surfaces.map((surface) => [theme, surface] as const)))(
    '%s: warning-fill (non-text) on %s is at least 3:1',
    (theme, surface) => {
      expect(
        contrastRatio(palette[theme]['warning-fill'], palette[theme][surface]),
      ).toBeGreaterThanOrEqual(3)
    },
  )
})

describe('app/globals.css matches app/ui/tokens.ts', () => {
  const css = readFileSync(new URL('../../globals.css', import.meta.url), 'utf8')
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
  const lightCss = css.slice(0, darkStart)
  const darkCss = css.slice(darkStart)

  function declared(block: string, token: ColorToken): string | undefined {
    const match = new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block)
    return match?.[1]?.toUpperCase()
  }

  it('has a dark block', () => {
    expect(darkStart).toBeGreaterThan(0)
  })

  const tokenNames = Object.keys(palette.light) as ColorToken[]

  it.each(tokenNames)('--color-%s has the light value', (token) => {
    expect(declared(lightCss, token)).toBe(palette.light[token].toUpperCase())
  })

  it.each(tokenNames)('--color-%s has the dark value', (token) => {
    expect(declared(darkCss, token)).toBe(palette.dark[token].toUpperCase())
  })

  it('makes the card shadow follow the theme through --elevation-card', () => {
    expect(css).toMatch(/--shadow-card:\s*var\(--elevation-card\)\s*;/)
    expect(lightCss).toMatch(/--elevation-card:\s*0 1px 2px/)
    expect(darkCss).toMatch(/--elevation-card:\s*none\s*;/)
  })
})
