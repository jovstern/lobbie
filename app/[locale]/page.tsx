import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('Home')

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
    </main>
  )
}
