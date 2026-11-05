import type { ReactNode } from 'react'

type Props = {
  /** Decorative: the title says it all. */
  icon: ReactNode
  title: string
  body: string
  /** What to do next, if anything. */
  children?: ReactNode
}

/** A join page's heading, its explanation and the next step. */
export default function JoinMessage({ icon, title, body, children }: Props) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="flex items-start gap-2 text-2xl font-semibold text-balance">
          {icon}
          {title}
        </h1>
        <p className="text-pretty">{body}</p>
      </header>
      {children ? <div>{children}</div> : null}
    </>
  )
}
