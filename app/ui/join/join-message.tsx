import type { ReactNode } from 'react'

type Props = {
  /** Decorative: the title says it all. */
  icon: ReactNode
  title: string
  body: string
  /** What to do next, if anything. */
  children?: ReactNode
}

/**
 * An invite's state under the join page's static heading: its title, its explanation and the
 * next step.
 */
export default function JoinMessage({ icon, title, body, children }: Props) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h2 className="flex items-start gap-2 text-xl font-semibold text-balance">
          {icon}
          {title}
        </h2>
        <p className="text-pretty">{body}</p>
      </header>
      {children ? <div>{children}</div> : null}
    </>
  )
}
