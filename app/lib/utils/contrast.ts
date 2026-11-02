const hexColor = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/** WCAG 2 relative luminance of a `#RRGGBB` colour. */
function relativeLuminance(color: string): number {
  const match = hexColor.exec(color)
  if (!match) throw new Error(`Expected a #RRGGBB hex colour, got ${JSON.stringify(color)}`)
  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
