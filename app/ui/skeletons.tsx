// Placeholders shaped like the content they stand for, so nothing shifts when it streams in.

const block = 'animate-pulse rounded-control bg-border'

export function SignInFormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className={`${block} h-5 w-16`} />
        <div className={`${block} h-11`} />
      </div>
      <div className={`${block} h-11`} />
    </div>
  )
}

export function ButtonSkeleton() {
  return <div aria-hidden className={`${block} h-11 w-28`} />
}
