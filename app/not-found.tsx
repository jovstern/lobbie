import Link from 'next/link'
import AuthCardFrame from '@/app/ui/auth/auth-card-frame'
import { buttonClassName } from '@/app/ui/button-styles'
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
        <AuthCardFrame
          appName={he.Auth.appName}
          tagline={he.Auth.tagline}
          panelDescription={he.Auth.panelDescription}
        >
          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">{he.NotFound.title}</h1>
              <p className="text-text-muted">{he.NotFound.description}</p>
            </header>
            <Link href="/" prefetch={false} className={buttonClassName('primary')}>
              {he.Common.backHome}
            </Link>
          </section>
          <section lang="en" dir="ltr" className="border-border flex flex-col gap-4 border-t pt-6">
            <header className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">{en.NotFound.title}</h2>
              <p className="text-text-muted">{en.NotFound.description}</p>
            </header>
            <Link href="/en" prefetch={false} className={buttonClassName('primary')}>
              {en.Common.backHome}
            </Link>
          </section>
        </AuthCardFrame>
      </body>
    </html>
  )
}
