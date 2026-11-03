import { Rubik } from 'next/font/google'

// Variable font: every weight from one file per subset, exposed as --font-rubik for @theme's
// --font-sans. `latin-ext` is preloaded too: its range (U+20A0-20AB) includes ₪, and as the
// later @font-face it is the one the browser fetches for the sign, so without the preload
// every amount waited for a third, undiscovered font file.
export const rubik = Rubik({
  subsets: ['hebrew', 'latin', 'latin-ext'],
  variable: '--font-rubik',
})
