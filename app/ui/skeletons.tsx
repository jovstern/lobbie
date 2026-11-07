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

/**
 * `/join`'s code form and the sign-out block below it, the same height as both: the card is
 * centred, so a shorter placeholder would move it when they stream in.
 */
export function JoinFormSkeleton() {
  return (
    <>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className={`${block} h-5 w-24`} />
          <div className={`${block} h-11`} />
          <div className={`${block} h-5 w-56 max-w-full`} />
        </div>
        <div className={`${block} h-11`} />
      </div>
      <div aria-hidden className="border-border flex flex-col items-start gap-3 border-t pt-6">
        <div className={`${block} h-5 w-48 max-w-full`} />
        <div className={`${block} h-11 w-28`} />
      </div>
    </>
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
      <AdminHeaderSkeleton />
      <div className={clsx(cardClassName, 'max-w-xl')}>
        <div className={`${block} h-6 w-40`} />
        <div className={`${block} h-5 w-72 max-w-full`} />
      </div>
    </div>
  )
}

/** An admin page's title and lead, before the role check lets them name the page. */
function AdminHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${block} h-8 w-40`} />
      <div className={`${block} h-6 w-full max-w-prose`} />
      <div className={`${block} h-6 w-2/3 max-w-prose`} />
    </div>
  )
}

/** The admin sections' tabs: one row of links (44 px) above the nav's bottom border. */
export function AdminNavSkeleton() {
  return (
    <div aria-hidden className="border-border flex gap-6 border-b">
      {['w-20', 'w-16', 'w-24', 'w-16'].map((width, tab) => (
        <div key={tab} className="flex min-h-11 items-center px-1">
          <div className={`${block} h-5 ${width}`} />
        </div>
      ))}
    </div>
  )
}

/** `/admin/building` below its header: the details form beside the fund. */
export function BuildingSettingsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <AdminHeaderSkeleton />
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

/**
 * `/admin/apartments` below its header: the count with the add button, then cards on phones or a
 * table from md.
 */
export function ApartmentsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <AdminHeaderSkeleton />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`${block} h-6 w-44`} />
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

/** `/admin/apartments/[id]` before the role check: the way back, the header and both cards. */
export function ApartmentPageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className={`${block} h-11 w-36`} />
      <div className="flex flex-col gap-2">
        <div className={`${block} h-8 w-32`} />
        <ApartmentFactsSkeleton />
      </div>
      <div className={clsx(cardClassName, 'mt-4 max-w-2xl')}>
        <div className="flex flex-col gap-1">
          <div className={`${block} h-7 w-24`} />
          <div className={`${block} h-6 w-full`} />
        </div>
        <ApartmentInviteSkeleton />
        <div className={`${block} h-10 w-full`} />
      </div>
      <div className={clsx(cardClassName, 'max-w-2xl')}>
        <div className={`${block} h-7 w-28`} />
        <ApartmentResidentsSkeleton />
      </div>
      <div className={clsx(cardClassName, 'max-w-2xl')}>
        <div className={`${block} h-7 w-36`} />
        <ApartmentFeeSkeleton />
      </div>
      <div className={clsx(cardClassName, 'max-w-2xl')}>
        <div className={`${block} h-7 w-28`} />
        <ApartmentPaymentsSkeleton />
      </div>
    </div>
  )
}

/**
 * The fee card's figure, whose fee it is, its button and the line below, shaped like an
 * apartment paying the building's fee.
 */
export function ApartmentFeeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className={`${block} h-8 w-32`} />
        <div className={`${block} h-6 w-36`} />
      </div>
      <div className={`${block} h-11 w-44`} />
      <div className={`${block} h-6 w-full max-w-md`} />
    </div>
  )
}

/**
 * The payments card's status chip and line, its button, and a short history, shaped like an
 * apartment that pays every month.
 */
export function ApartmentPaymentsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="rounded-chip bg-border h-8 w-20 animate-pulse" />
        <div className={`${block} h-6 w-48`} />
      </div>
      <div className={`${block} h-11 w-44`} />
      <div className={`${block} h-6 w-36`} />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <div className={`${block} h-6 w-40`} />
            <div className={`${block} h-11 w-24`} />
          </div>
          <div className={`${block} h-5 w-full max-w-sm`} />
        </div>
      ))}
    </div>
  )
}

/** `/admin/fees`: its header, then the building's fee beside the apartments' own. */
export function FeesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <AdminHeaderSkeleton />
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className={cardClassName}>
          <div className={`${block} h-7 w-36`} />
          <div className="flex flex-col gap-1">
            <div className={`${block} h-9 w-40`} />
            <div className={`${block} h-6 w-36`} />
          </div>
          <div className={`${block} h-11 w-40`} />
          <div className={`${block} h-6 w-20`} />
          <FeeHistorySkeleton rows={2} />
        </div>
        <div className={cardClassName}>
          <div className="flex flex-col gap-1">
            <div className={`${block} h-7 w-40`} />
            <div className={`${block} h-6 w-full`} />
            <div className={`${block} h-6 w-2/3`} />
          </div>
          <div className={`${block} h-11 w-48`} />
          {[0, 1].map((apartment) => (
            <div key={apartment} className="flex flex-col gap-3">
              <div className={`${block} h-6 w-28`} />
              <FeeHistorySkeleton rows={1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A fee history's rows: the months and amount, then who set it. */
function FeeHistorySkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <div className={`${block} h-6 w-40`} />
            <div className={`${block} h-6 w-16`} />
          </div>
          <div className={`${block} h-5 w-48`} />
        </div>
      ))}
    </div>
  )
}

/** An apartment's number in its heading, while it streams. */
export function ApartmentNumberSkeleton() {
  return <span aria-hidden className={`${block} inline-block h-7 w-10 align-middle`} />
}

/** An apartment's floor and billing start, and its Edit button. */
export function ApartmentFactsSkeleton() {
  return (
    <div aria-hidden className="flex flex-wrap items-center justify-between gap-4">
      <div className={`${block} h-6 w-64 max-w-full`} />
      <div className={`${block} h-11 w-28`} />
    </div>
  )
}

/**
 * The invite card's status and buttons, shaped like an active invite (its uses and expiry wrap
 * to two lines on phones, its two buttons to two rows); an apartment without one is shorter.
 */
export function ApartmentInviteSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className={`${block} h-6 w-28`} />
        <div className={`${block} h-6 w-64 max-w-full`} />
        <div className={`${block} h-6 w-40 sm:hidden`} />
      </div>
      <div className="flex flex-col gap-4">
        <div />
        {/* "Create new invite" and "Revoke": a row each on phones. */}
        <div className="flex flex-wrap gap-3">
          <div className={`${block} h-11 w-full sm:w-44`} />
          <div className={`${block} h-11 w-28`} />
        </div>
      </div>
    </div>
  )
}

/** The residents card's rows: one each, with the owner/tenant choice and Remove. */
export function ApartmentResidentsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {[0, 1].map((row) => (
        <div key={row} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className={`${block} h-6 w-36`} />
            <div className={`${block} h-5 w-48`} />
          </div>
          <div className="flex gap-3">
            <div className={`${block} h-11 w-40`} />
            <div className={`${block} h-11 w-28`} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The invite card of `/join` and `/join/[code]`: a heading, a sentence and the action. */
export function JoinInviteSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className={`${block} h-7 w-56 max-w-full`} />
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
      <AdminHeaderSkeleton />
      <div className="flex max-w-md flex-col gap-2">
        <div className={`${block} h-5 w-28`} />
        <div className={`${block} h-11`} />
        <div className={`${block} h-5 w-48`} />
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
