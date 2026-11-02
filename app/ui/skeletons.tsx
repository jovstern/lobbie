import type { ReactNode } from 'react'
import clsx from 'clsx'
import { cardClassName, homeCardHeights } from '@/app/ui/card'

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

function CardSkeleton({ minHeight, children }: { minHeight: string; children: ReactNode }) {
  return (
    <div aria-hidden className={clsx(cardClassName, minHeight)}>
      <div className={`${block} h-6 w-32`} />
      {children}
    </div>
  )
}

/** Shaped like the card for `apartments` apartments: one in full, or one row each. */
export function StatusCardSkeleton({ apartments = 1 }: { apartments?: number }) {
  return (
    <CardSkeleton minHeight={homeCardHeights.status}>
      {apartments > 1 ? (
        <ul className="divide-border flex flex-col divide-y">
          {Array.from({ length: apartments }, (_, row) => (
            <li key={row} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className={`${block} h-6 w-24`} />
                <div className={`${block} h-8 w-20`} />
              </div>
              <div className={`${block} h-5 w-40`} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className={`${block} h-8 w-24`} />
          <div className={`${block} h-12 w-40`} />
          <div className={`${block} h-6 w-48`} />
        </>
      )}
    </CardSkeleton>
  )
}

export function BalanceCardSkeleton() {
  return (
    <CardSkeleton minHeight={homeCardHeights.balance}>
      <div className={`${block} h-12 w-44`} />
      <div className={`${block} h-6 w-24`} />
    </CardSkeleton>
  )
}

export function HomeSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <StatusCardSkeleton />
      <BalanceCardSkeleton />
    </div>
  )
}

export function BuildingNameSkeleton() {
  return <div aria-hidden className={`${block} h-6 w-36`} />
}

export function ProfileSkeleton() {
  return (
    <div aria-hidden className={cardClassName}>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-1">
          <div className={`${block} h-5 w-16`} />
          <div className={`${block} h-6 w-48`} />
        </div>
      ))}
    </div>
  )
}
