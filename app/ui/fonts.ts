import { Rubik } from 'next/font/google'

// Variable font: every weight from one file per subset, exposed as --font-rubik for @theme's
// --font-sans. `subsets` only chooses what is preloaded: every subset's @font-face is declared
// in the one stylesheet, `latin-ext` (U+20A0-20AB, which holds ₪) included. Hebrew and Latin
// are preloaded on every page; ₪'s file loads when an amount is first laid out, shown in the
// fallback until then (font-display: swap), so no page waits on it. A second instance that
// preloaded it on the pages with amounts cost them a second render-blocking stylesheet.
export const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
})
