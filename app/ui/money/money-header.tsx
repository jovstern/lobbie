import { useTranslations } from 'next-intl'
import MoneyNav, { type MoneyPage } from '@/app/ui/money/money-nav'

/**
 * The Money tab's navigation, then the page's title and a line on what it shows: static, so
 * the page's shell carries it.
 */
export default function MoneyHeader({ current }: { current: MoneyPage }) {
  const tMoney = useTranslations('Money')
  const tBalance = useTranslations('Balance')
  const { title, lead } =
    current === 'apartment'
      ? { title: tMoney('title'), lead: tMoney('lead') }
      : { title: tBalance('title'), lead: tBalance('lead') }

  return (
    <div className="flex flex-col gap-6">
      <MoneyNav current={current} />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        <p className="text-text-muted max-w-prose text-pretty">{lead}</p>
      </header>
    </div>
  )
}
