import { Rubik } from 'next/font/google'

// Rubik again, for the pages that show amounts, so that only they preload `latin-ext`: its
// range (U+20A0-20AB) includes ₪, and without the preload every amount waits for a font file
// the browser finds only once the text is laid out.
// It preloads Hebrew and Latin too, though the layout's instance already does. Both instances
// declare the family "Rubik" for the same ranges, and the later declaration (this page's) wins;
// next/font names a preloaded file differently from one that is not, so a subset left out here
// would point the page at a second, unpreloaded copy of a file it already has.
export const moneyFont = Rubik({ subsets: ['hebrew', 'latin', 'latin-ext'] })
