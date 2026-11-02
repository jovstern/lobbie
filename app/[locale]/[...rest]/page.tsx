import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound')
  return { title: t('title') }
}

// Always a 404, so there is no target segment for dev-time instant validation to render.
export const instant = false

// The proxy sends every unknown path into `[locale]`; this turns it into the localized 404.
export default function CatchAllPage() {
  notFound()
}
