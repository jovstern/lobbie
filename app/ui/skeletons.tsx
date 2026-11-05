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

/**
 * Where the language link cannot render yet: its own box (padding, icon, gap) around a block
 * as wide as "English", the longer of the two names, so nothing moves when it streams in.
 */
export function LanguageSwitchSkeleton() {
  return (
    <div aria-hidden className="inline-flex min-h-11 items-center gap-2 px-3">
      <div className={`${block} size-5`} />
      <div className={`${block} h-5 w-14`} />
    </div>
  )
}

/** `/profile`: the details form, then the directory switch and the language choice. */
export function ProfileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className={cardClassName}>
        <div className={`${block} h-6 w-28`} />
        {[0, 1].map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <div className={`${block} h-5 w-16`} />
            <div className={`${block} h-11`} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <div className={`${block} h-5 w-16`} />
          <div className={`${block} h-6 w-56 max-w-full`} />
        </div>
        <div className={`${block} h-11 w-24`} />
      </div>
      <div className={cardClassName}>
        <div className={`${block} h-6 w-28`} />
        <div className={`${block} h-11`} />
        <div className={`${block} h-4 w-3/4`} />
      </div>
      <div className={cardClassName}>
        <div className={`${block} h-6 w-20`} />
        <div className={`${block} h-12 w-44`} />
      </div>
    </div>
  )
}

/** The admin overview: its heading, a lead line and one link card. */
export function AdminOverviewSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className={`${block} h-10 w-32`} />
      <div className={`${block} h-6 w-64`} />
      <div className={clsx(cardClassName, 'max-w-xl')}>
        <div className={`${block} h-6 w-40`} />
        <div className={`${block} h-5 w-72 max-w-full`} />
      </div>
    </div>
  )
}

/** `/admin/building`: the details form beside the fund. */
export function BuildingSettingsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className={`${block} h-10 w-56`} />
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className={cardClassName}>
          <div className={`${block} h-6 w-24`} />
          {[0, 1, 2, 3].map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <div className={`${block} h-5 w-32`} />
              <div className={`${block} h-11`} />
            </div>
          ))}
          <div className={`${block} h-11 w-24`} />
        </div>
        <div className={cardClassName}>
          <div className={`${block} h-6 w-32`} />
          <div className={`${block} h-5 w-28`} />
          <div className={`${block} h-8 w-36`} />
          <div className="flex items-center justify-between gap-3">
            <div className={`${block} h-7 w-28`} />
            <div className={`${block} h-11 w-40`} />
          </div>
          <div className={`${block} h-24`} />
        </div>
      </div>
    </div>
  )
}

/** `/admin/apartments`: the header with its button, then cards on phones or a table from md. */
export function ApartmentsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className={`${block} h-10 w-32`} />
          <div className={`${block} h-6 w-44`} />
        </div>
        <div className={`${block} h-11 w-40`} />
      </div>
      {/* "Invite the residents". */}
      <div className={cardClassName}>
        <div className="flex flex-col gap-2">
          <div className={`${block} h-7 w-40`} />
          <div className={`${block} h-6 w-96 max-w-full`} />
        </div>
        <div className={`${block} h-11 w-72 max-w-full`} />
      </div>
      {/* Phones: one card per apartment. */}
      <div className="flex flex-col gap-3 md:hidden">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="rounded-card border-border bg-surface-raised flex flex-col gap-3 border p-4"
          >
            <div className={`${block} h-7 w-32`} />
            <div className={`${block} h-5 w-56 max-w-full`} />
            <div className="flex gap-2">
              <div className={`${block} h-11 w-24`} />
              <div className={`${block} h-11 w-24`} />
            </div>
          </div>
        ))}
      </div>
      {/* From tablet width: the table, its header row and a row per apartment. */}
      <div className="rounded-card border-border bg-surface-raised divide-border hidden flex-col divide-y border md:flex">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="grid grid-cols-[1fr_1fr_1.5fr_1fr_2fr] items-center gap-4 px-4 py-3"
          >
            <div className={`${block} ${row === 0 ? 'h-5' : 'h-6'} w-12`} />
            <div className={`${block} h-5 w-8`} />
            <div className={`${block} h-5 w-28`} />
            <div className={`${block} h-5 w-8`} />
            {row === 0 ? (
              <div />
            ) : (
              <div className="flex gap-2">
                <div className={`${block} h-11 w-24`} />
                <div className={`${block} h-11 w-24`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** `/admin/apartments/[id]`: the back link, the apartment's header and its invite card. */
export function ApartmentDetailsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className={`${block} h-11 w-36`} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className={`${block} h-10 w-40`} />
          <div className={`${block} h-6 w-64 max-w-full`} />
        </div>
        <div className={`${block} h-11 w-28`} />
      </div>
      <div className={clsx(cardClassName, 'mt-2 max-w-2xl')}>
        <div className="flex flex-col gap-2">
          <div className={`${block} h-7 w-28`} />
          <div className={`${block} h-6 w-80 max-w-full`} />
        </div>
        <div className={`${block} h-6 w-72 max-w-full`} />
        <div className={`${block} h-11 w-40`} />
        <div className={`${block} h-10 w-full`} />
      </div>
      {/* Residents: one row each, with the owner/tenant choice and Remove. */}
      <div className={clsx(cardClassName, 'max-w-2xl')}>
        <div className={`${block} h-7 w-28`} />
        {[0, 1].map((row) => (
          <div key={row} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className={`${block} h-6 w-36`} />
              <div className={`${block} h-5 w-48`} />
            </div>
            <div className="flex gap-3">
              <div className={`${block} h-11 w-40`} />
              <div className={`${block} h-11 w-24`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The invite card of `/join` and `/join/[code]`: a heading, a sentence and the action. */
export function JoinInviteSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className={`${block} h-8 w-56 max-w-full`} />
      <div className={`${block} h-6 w-full`} />
      <div className={`${block} h-11 w-44`} />
    </div>
  )
}

/** The people list of `/admin/people`: its count, then cards on phones or a table from md. */
export function PeopleListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className={`${block} h-6 w-48`} />
      {/* Phones: one card per person. */}
      <div className="flex flex-col gap-3 md:hidden">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="rounded-card border-border bg-surface-raised flex flex-col gap-3 border p-4"
          >
            <div className={`${block} h-7 w-40`} />
            <div className={`${block} h-5 w-56 max-w-full`} />
            <div className={`${block} h-11 w-24`} />
            <div className="flex gap-2">
              <div className={`${block} h-11 w-36`} />
              <div className={`${block} h-11 w-24`} />
            </div>
          </div>
        ))}
      </div>
      {/* From tablet width: the table, its header row and a row per person. */}
      <div className="rounded-card border-border bg-surface-raised divide-border hidden flex-col divide-y border md:flex">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-[2fr_1fr_1fr_2fr] items-center gap-4 px-4 py-3">
            <div className={`${block} ${row === 0 ? 'h-5' : 'h-10'} w-40`} />
            <div className={`${block} h-5 w-16`} />
            <div className={`${block} h-5 w-20`} />
            {row === 0 ? (
              <div />
            ) : (
              <div className="flex gap-2">
                <div className={`${block} h-11 w-36`} />
                <div className={`${block} h-11 w-24`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** `/admin/people`: the heading, the search field and the list. */
export function PeopleSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className={`${block} h-10 w-28`} />
        <div className="flex max-w-md flex-col gap-2">
          <div className={`${block} h-5 w-28`} />
          <div className={`${block} h-11`} />
          <div className={`${block} h-5 w-48`} />
        </div>
      </div>
      <PeopleListSkeleton />
    </div>
  )
}

/** The directory's floors: a heading each, then apartment cards with their residents. */
export function DirectoryListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      {[0, 1].map((floor) => (
        <div key={floor} className="flex flex-col gap-3">
          <div className={`${block} h-7 w-28`} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((apartment) => (
              <div
                key={apartment}
                className="rounded-card border-border bg-surface-raised flex flex-col gap-3 border p-4"
              >
                <div className={`${block} h-6 w-24`} />
                {[0, 1].map((resident) => (
                  <div key={resident} className="flex flex-col gap-1">
                    <div className={`${block} h-6 w-40`} />
                    {/* Some residents share a contact and some do not. */}
                    {resident === 0 ? <div className={`${block} h-11 w-36`} /> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** `/building/directory` below its header: the search field and the floors. */
export function DirectorySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex max-w-md flex-col gap-2">
        <div className={`${block} h-5 w-36`} />
        <div className={`${block} h-11`} />
        <div className={`${block} h-5 w-48`} />
      </div>
      <DirectoryListSkeleton />
    </div>
  )
}

/** `/building/committee` below its header: a card per member. */
export function CommitteeSkeleton() {
  return (
    <div aria-hidden className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((member) => (
        <div
          key={member}
          className="rounded-card border-border bg-surface-raised flex flex-col gap-3 border p-4"
        >
          <div className="flex flex-col gap-1">
            <div className={`${block} h-7 w-36`} />
            <div className={`${block} h-6 w-20`} />
          </div>
          <div className={`${block} h-11 w-44`} />
        </div>
      ))}
    </div>
  )
}
