import type { Metadata, Viewport } from 'next'
import { getTranslations } from 'next-intl/server'
import SideNav from '@/app/ui/nav/side-nav'
import TabBar from '@/app/ui/nav/tab-bar'
import TopBar from '@/app/ui/nav/top-bar'

// The pages' metadata waits for the session, so Next streams all of it into the body; the tags
// that matter before it (robots, description) are rendered below instead, and React hoists them
// into the static shell's head. Null here, so the streamed metadata does not repeat it.
export const metadata: Metadata = { description: null }

// Lets the tab bar reach the bottom edge on phones with a home indicator; it pads itself with
// the safe-area inset.
export const viewport: Viewport = { viewportFit: 'cover' }

export default async function AppLayout({ children }: LayoutProps<'/[locale]'>) {
  const [t, tMetadata] = await Promise.all([getTranslations('Nav'), getTranslations('Metadata')])

  return (
    <div className="flex min-h-dvh">
      {/* The signed-in app is private: search engines skip every page under it. */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="description" content={tMetadata('description')} />
      <a
        href="#main"
        className="rounded-control bg-accent text-on-accent fixed start-2 top-2 z-20 px-4 py-3 font-medium not-focus:sr-only"
      >
        {t('skipToContent')}
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {/* The bottom padding keeps the last content above the tab bar on phones. */}
        {/* Focusable by the skip link only, so focus lands here and the next Tab moves on. */}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] outline-none lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  )
}
