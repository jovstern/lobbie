import { Rubik } from 'next/font/google'

// Variable font: every weight from one file per subset, exposed as --font-rubik for @theme's
// --font-sans. `subsets` only chooses what is preloaded: every subset's @font-face is still
// declared. Hebrew and Latin are on every page; `latin-ext`, which holds ₪, is preloaded only
// where amounts are shown (see money-font.ts), so other pages do not fetch a file they skip.
export const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
})
