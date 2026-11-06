// The colour palette from spec §7, the single source for the contrast test.
// app/globals.css declares the same values; a test fails if the two drift apart.
export const palette = {
  light: {
    surface: '#FBF8F3',
    'surface-raised': '#FFFFFF',
    border: '#E7E0D6',
    text: '#1F1B16',
    'text-muted': '#6B6259',
    accent: '#B54E29',
    'accent-strong': '#9A4222',
    'on-accent': '#FFFFFF',
    success: '#2F7A4F',
    warning: '#8A5A12',
    'warning-fill': '#B7791F',
    danger: '#B23A3A',
    'danger-strong': '#973131',
  },
  dark: {
    surface: '#16130F',
    'surface-raised': '#221D18',
    border: '#3A332B',
    text: '#F3EEE7',
    'text-muted': '#B3A89B',
    accent: '#E07A52',
    'accent-strong': '#E8916F',
    'on-accent': '#16130F',
    success: '#5FB384',
    warning: '#E0A94A',
    'warning-fill': '#E0A94A',
    danger: '#EC7B7B',
    'danger-strong': '#F09393',
  },
} as const

export type Theme = keyof typeof palette
export type ColorToken = keyof (typeof palette)['light']
