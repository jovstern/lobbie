import { useTranslations } from 'next-intl'

/** `/money`'s title and a line on what it shows: static, so the page's shell carries it. */
export default function MoneyHeader() {
  const t = useTranslations('Money')

  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-balance">{t('title')}</h1>
      <p className="text-text-muted max-w-prose text-pretty">{t('lead')}</p>
    </header>
  )
}
