import Link from 'next/link'
import { rubik } from '@/app/ui/fonts'
import en from '@/messages/en.json'
import he from '@/messages/he.json'
import '@/app/globals.css'

// Rendered only for paths outside `[locale]` (those the proxy does not match), so there is
// no locale to choose: the page speaks both languages, Hebrew first.
// The links do not prefetch: the locale pages have another root layout, so following one is
// a full page load anyway, and prefetching a page that redirects a signed-out visitor to
// sign-in comes back from Next as a 404 (a console error).

export default function GlobalNotFound() {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <head>
        {/* With no root layout above this file, Next applies no `metadata` export here. */}
        <title>{`${he.NotFound.title} | ${he.Metadata.appName}`}</title>
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <main className="mx-auto flex max-w-md flex-col gap-10 p-8">
          <section className="flex flex-col items-start gap-4">
            <h1 className="text-2xl font-semibold">{he.NotFound.title}</h1>
            <p className="text-text-muted">{he.NotFound.description}</p>
            <Link
              href="/"
              prefetch={false}
              className="text-accent font-medium underline underline-offset-4"
            >
              {he.Common.backHome}
            </Link>
          </section>
          <section lang="en" dir="ltr" className="flex flex-col items-start gap-4">
            <h2 className="text-xl font-semibold">{en.NotFound.title}</h2>
            <p className="text-text-muted">{en.NotFound.description}</p>
            <Link
              href="/en"
              prefetch={false}
              className="text-accent font-medium underline underline-offset-4"
            >
              {en.Common.backHome}
            </Link>
          </section>
        </main>
      </body>
    </html>
  )
}
