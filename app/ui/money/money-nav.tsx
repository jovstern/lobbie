import { useTranslations } from 'next-intl'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

export type MoneyPage = 'apartment' | 'fund'

const pages = [
  { page: 'apartment', href: '/money' },
  { page: 'fund', href: '/money/balance' },
] as const

/**
 * The Money tab's two pages: the person's apartment and the building fund. Each page says
 * which it is, so the links need no client code; the Money tab stays current on both.
 */
export default function MoneyNav({ current }: { current: MoneyPage }) {
  const t = useTranslations('MoneyNav')
  const tMoney = useTranslations('Money')
  const tBalance = useTranslations('Balance')
  const labels = { apartment: tMoney('title'), fund: tBalance('title') }

  return (
    <nav aria-label={t('label')}>
      <ul className="border-border flex gap-6 border-b">
        {pages.map(({ page, href }) => (
          <li key={page}>
            <Link
              href={href}
              aria-current={page === current ? 'page' : undefined}
              className="text-text-muted hover:text-text active:text-text aria-[current=page]:border-accent aria-[current=page]:text-text relative -mb-px inline-flex min-h-11 items-center border-b-2 border-transparent font-medium transition-[border-color,color]"
            >
              {labels[page]}
              <LinkPending className="-end-2.5 top-2" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
