import MoneyHeader from '@/app/ui/money/money-header'

// The header is the same for everyone, so it sits in the layout: painted from the static shell
// and never replaced. In the page or its loading state, the loading state's copy was swapped
// for the page's when the page streamed in, and that second paint became the page's LCP.
export default function BalanceLayout({ children }: LayoutProps<'/[locale]/money/balance'>) {
  return (
    <div className="flex flex-col gap-6">
      <MoneyHeader current="fund" />
      {children}
    </div>
  )
}
