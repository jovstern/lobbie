import type { ComponentType, ReactNode, SVGProps } from 'react'

type Props = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  body: string
  /** Under the page's `h1` by default. */
  headingLevel?: 2 | 3
  /** The next step, such as a link, when there is one. */
  children?: ReactNode
}

/** What a list shows when it has nothing: what that means, and what to do next. */
export default function EmptyState({ icon: Icon, title, body, headingLevel = 2, children }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div className="rounded-card border-border bg-surface-raised flex max-w-xl flex-col items-start gap-3 border p-6">
      <Icon aria-hidden className="text-text-muted size-8" />
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="text-text-muted">{body}</p>
      {children}
    </div>
  )
}
