# Lobbie — design spec

> *Everyone under one roof.* Source: `docs/brief.md` (product brief) and the `/build`
> discovery of 2026-10-29 → 2026-11-02. Architecture: `docs/adr/0001-architecture.md`.

## 1. Goal and audience

A responsive web app (phone first) where the residents of one building see everything about
it, and the building committee (ועד בית) runs it from one place.

- **Residents** (owners and tenants): payment status, the building fund, schedules,
  announcements, directory, parking, cameras, the meeting poll.
- **Committee:** fees, payments, expenses, schedules, announcements, parking, meeting polls.
- **Admin** (often a committee member): building details, apartments, invites, roles, cameras.
- **Visitors** (portfolio): a read-only demo of the seeded building from the welcome page.

**The one thing:** a resident opens Lobbie and in five seconds knows whether they are paid
up, how much the building has, and what is happening this week.

**Success:** a committee sets up a building and invites every apartment in under 30
minutes; residents stop asking "did I pay?", "when is the cleaner coming?" and "who parks in
spot 7?" in WhatsApp; the annual meeting date is picked by the system.

## 2. Requirements checklist

IDs are referenced by the plan and the PRs.

**Foundation**
- [ ] R1 Hebrew (RTL, default, unprefixed URLs) and English (LTR, `/en/...`) on every screen; the choice is saved in a cookie and the profile.
- [ ] R2 Phone-first layout: bottom tab bar on phones (Home, Money, Schedule, Building, More), side nav from 1024 px; admin section shown only to committee and admin.
- [ ] R3 Warm design system: tokens, Rubik, light and dark themes following the system, AA contrast in both.
- [ ] R4 Postgres schema with migrations, constraints and indexes; an idempotent seed of a demo building.
- [ ] R5 Sign in with an email magic link (in the user's language); sign out; every app route requires a session; sign-in is rate-limited per email and per IP and never reveals whether an email is known.

**The building and its people**
- [ ] R6 Roles `resident` < `committee` < `admin` per person per building, enforced on the server in every page, data function and action; everything scoped to the user's building.
- [ ] R7 Admin edits building details (name, address, quorum %, billing start month). The opening balance is set when the building is created; any later correction is a recorded balance adjustment (amount, reason, who, when).
- [ ] R8 Admin adds, edits and removes apartments (number, floor, billing start month).
- [ ] R9 Invites: one link per apartment (reusable by up to 6 people, 14-day expiry, revocable); "Create invites for all apartments" gives a copyable list; a signed-in user redeems a link or types a code and joins that apartment. Code entry is rate-limited.
- [ ] R10 Admin manages people: role, committee title, owner/tenant per apartment, remove from an apartment or the building; the last admin cannot be removed or demoted.
- [ ] R11 Residents directory by floor and apartment; a resident's phone and email shown only if they opted in.
- [ ] R12 Committee page: members and titles, with a committee contact (phone and/or email) each member chooses to publish for this role, separate from their personal opt-in.
- [ ] R13 Profile and settings: name, phone, language, directory contact visibility, committee contact (committee only).

**Money**
- [ ] R14 Monthly fee: a building default plus per-apartment overrides, each effective from a month (history kept).
- [ ] R15 Committee records payments (apartment, one or several months, amount, date, method, note); payments are never edited, only voided with a reason; a payment cannot exceed what is still owed for its month.
- [ ] R16 A resident sees their apartment's status per month (`paid` / `due` / `overdue`) and payment history.
- [ ] R17 The committee sees every apartment's status (apartment × month grid) and who is behind with the amount owed; `/admin` opens on that overview.
- [ ] R18 The committee records expenses (category, amount, date, description, receipt upload up to 4 MB); voided, never edited.
- [ ] R19 Building balance = opening balance + adjustments + payments − expenses (non-voided), computed, never stored; income and expenses by category and month; receipts open only for building members.
- [ ] R20 In-app overdue reminder: the committee sends one per apartment (at most one a week); the resident sees a banner on Home and Money until that month is paid.

**Life in the building**
- [ ] R21 Recurring schedules (cleaning, garden, garbage, recycling, other): weekly or every N weeks on chosen weekdays, at a time, from a start date, optional end.
- [ ] R22 Schedule exceptions: cancel or move a single occurrence, with a note ("no cleaning on Sukkot").
- [ ] R23 Weekly schedule view with previous/next week in the URL.
- [ ] R24 Announcements: committee writes, pins and archives; residents read a feed with pinned first.
- [ ] R25 Home "this week": payment status, balance, next date per schedule kind, latest and pinned announcements, the open meeting poll, any reminder.

**Parking and cameras**
- [ ] R26 Parking spots: committee creates spots, assigns an apartment or marks guest; residents see the list grouped and their own spots first.
- [ ] R27 Cameras: admin adds a camera (name, location, kind `embed` or `snapshot`, URL, minimum role that can see it), with a "shared areas only" notice; URLs never reach a user whose role cannot see that camera, and snapshot URLs never reach the browser at all.
- [ ] R28 Cameras page shows embeds and refreshing snapshots (through an authorized, SSRF-safe server proxy); the page and its nav item are hidden when the user can see no camera.

**Annual meeting**
- [ ] R29 Committee opens a poll with candidate slots (start, duration, location), closes it, and confirms a slot (never automatic).
- [ ] R30 One vote per apartment per slot (`yes` / `maybe` / `no`), changeable while open; any member of the apartment can vote; a person in two apartments picks which apartment they vote for.
- [ ] R31 Ranking: most `yes`, then highest score (yes 2, maybe 1, no 0), then fewest `no`, then earliest; each slot shows quorum reached for `yes` and for `yes + maybe`.
- [ ] R32 Confirming posts an announcement and offers an `.ics` "Add to calendar" download.
- [ ] R33 The committee writes the minutes as text in the app; residents read them on the meeting page.

**Launch**
- [ ] R34 Production on Vercel at `lobbie.co.il`: Neon `main`, Resend email from the domain, Vercel Blob for receipts; a script creates a real building and its first admin.
- [ ] R35 Public welcome page; metadata and Open Graph images; sitemap and robots; favicon and manifest.
- [ ] R36 404, error and global-error pages in both languages; security headers including a CSP.
- [ ] R37 Vercel Analytics, Speed Insights and runtime logs live; Web Vitals reported from M1 (logger) and to analytics at launch.
- [ ] R38 Every screen has its loading, empty and error states; zero axe violations; keyboard-complete.
- [ ] R39 README: what it is, live URL, how to run and test, architecture and ADRs, metrics, demo GIFs, what's next.
- [ ] R40 "Try the demo" on the welcome page signs a visitor in as a demo resident or a demo committee member of the demo building; every write in a demo building is refused on the server with a friendly message.

## 3. Assumptions and rules (decided, not asked)

- **One building per user** in v1, enforced: `building_members.userId` is unique. A person
  may live in several apartments of that building. Their role, committee title and contact
  settings belong to the person in the building, not to an apartment.
- Building time zone `Asia/Jerusalem` (a column); "today", "this month" and "this week"
  (Sunday–Saturday) are computed in it.
- Currency ILS; money as integer agorot; formatted with `Intl.NumberFormat` in the active
  locale. Postgres sums are cast to `integer`/`bigint` and parsed with Zod (postgres-js
  returns `bigint` sums as strings).
- **Month status:** an apartment owes from its own billing start month (default: the
  building's). The amount due is the fee in force that month. `paid` when non-voided
  payments for that month cover it; the current month unpaid is `due`; an earlier month
  unpaid is `overdue`. Partial payments show the remaining amount and keep the status.
  Recording more than the remaining amount for a month is rejected (the form says how much
  is owed); paying several months splits into one payment row per month in one transaction.
  A payment is dated today or earlier, and no earlier than a year before its apartment's
  billing start month (advance payments, mirroring the year ahead it may go).
- Fee changes apply from a month onward and never rewrite earlier months: once a building or
  apartment has a fee, a new one starts no earlier than the current month (the first may start
  at billing start), and at most 12 months ahead. An apartment's own fee can be ended from a
  month, after which it follows the building fee again.
- A user signed in without a membership sees only `/join` (enter a code).
- **Invites:** per apartment, reusable by up to 6 people until expiry (14 days) or revoke;
  the code (10 characters from an unambiguous alphabet) is stored hashed; the link carries
  the code. Redemption is one atomic `UPDATE … WHERE` + insert in a transaction.
- Expense categories are a fixed list: cleaning, garden, elevator, electricity, water,
  repairs, insurance, other.
- Receipts: JPEG, PNG, WebP or PDF, at most 4 MB (Vercel's request limit is 4.5 MB),
  type checked by magic bytes; PDFs served as attachments.
- Camera kinds in v1: `embed` (an `https` iframe URL, rendered with `sandbox="allow-scripts
  allow-same-origin"` and `referrerpolicy="no-referrer"`) and `snapshot` (an `http(s)` image
  URL, credentials allowed, fetched only by the server proxy every 10 s while the page is
  visible). HLS is later. Visibility is a minimum role.
- Reminders are in-app only. The only email Lobbie sends is the magic link.
- **Demo buildings** (`buildings.isDemo`): the seed creates one; at launch two demo users
  (resident, committee) can be signed in from `/welcome` without email. Every action checks
  `isDemo` after authorization and refuses writes with "This is a demo building; changes are
  turned off". Profile language changes still work (cookie only).
- WCAG 2.2 AA. Checked at 360, 768, 1024 and 1440 px.
- Analytics only from launch (Vercel Web Analytics, cookieless).

## 4. Stack

Per ADR 0001. Stack-conventions files that apply: **`SKILL.md`, `nextjs.md`, `sql.md`,
`styling.md`** (Tailwind), plus `ui-craft` and `metrics`.

| Piece | Choice |
|---|---|
| Framework | Next.js 16.4 App Router, TypeScript strict, React Compiler, Cache Components, partial prefetching |
| Data | Postgres on Neon (`dev`, `test` branches; `main` at launch); Drizzle ORM 0.45 on `postgres` 3.4; `drizzle-kit` SQL migrations |
| Tests | Vitest + PGlite (data layer); Testing Library; Playwright + `@axe-core/playwright` against the Neon `test` branch |
| Auth | Better Auth 1.7: magic-link plugin (its HTTP request endpoint disabled, tokens stored hashed), Drizzle adapter, `session.cookieCache` on (renewed by the proxy), ids generated as uuid, `user.phone`/`locale` with `input: false`; its CLI (the `auth` package) generates its tables into the Drizzle schema, timestamps post-processed to `timestamptz` |
| i18n | next-intl 4, `localePrefix: 'as-needed'`, `he` default, `en`; `localeDetection: false` (Hebrew whatever the browser), the proxy redirects unprefixed URLs to `/en` when the `NEXT_LOCALE` cookie is `en` |
| Styling | Tailwind v4, tokens in `@theme`, logical utilities only; Radix (`radix-ui`); `@heroicons/react` |
| Mail | `app/lib/mail.ts`: `outbox` transport only when `MAIL_TRANSPORT=outbox` (refuses to start if `VERCEL_ENV` is set); Resend at launch |
| Files | `app/lib/storage.ts` (`put`, `get`, `remove` by key): local disk under `.data/uploads/` now; Vercel Blob at launch; always served through an authorized Route Handler |
| Logging | `app/lib/logger.ts`: JSON lines (level, msg, route, durationMs, err); `app/ui/web-vitals.tsx` from M1 |
| Hosting | Local until M7; Vercel at launch |

### Code layout

```
app/
  [locale]/
    layout.tsx                    root layout: <html lang dir>, fonts, generateStaticParams(locales),
                                  locale via getLocale() (i18n/request.ts reads next/root-params;
                                  no setRequestLocale, deprecated in next-intl 4.14),
                                  NextIntlClientProvider (client messages only)
    (public)/sign-in/…  (public)/join/…  (public)/welcome/…
    (app)/layout.tsx              the shell: nav (role-dependent items in Suspense)
    (app)/(home)/page.tsx         Home (the group gives Home its own loading.tsx)
    (app)/money/…  schedule/…  building/…  meeting/…  more/…  profile/…  admin/…
  not-found.tsx                   for unmatched non-locale paths (own <html>)
  api/auth/[...all]/route.ts            Better Auth (M1)
  api/files/[id]/route.ts               receipts (M3)
  api/cameras/[id]/snapshot/route.ts    (M5)
  api/meetings/[id]/ics/route.ts        (M6)
  lib/
    db.ts                         the app's client; db-client.ts opens one (app, scripts, tests)
    env.ts                        requireEnv(name): names a missing variable, never its value
    schema.ts  auth-schema.ts     app tables; Better Auth's (from `npm run auth:generate`)
    auth.ts  auth-options.ts      Better Auth; the options that shape its schema (CLI input)
    definitions.ts  session.ts  authz.ts  mail.ts  storage.ts  logger.ts  rate-limit.ts
    safe-fetch.ts
    admin-guard.ts                lockMember: the row locks and last-admin guard of role
                                  changes and removals
    join-limits.ts                the rate limits of joining (per person, and misses per IP)
    billing.ts                    readBilling: what one apartment owes, read fresh (inside a
                                  recording's transaction too)
    data/<area>.ts                one async function per query, building-scoped
    data/cache-tags.ts            the `building:<id>` tags of the cached building-wide reads
    actions/<area>.ts             'use server'; Zod schemas and State types next to each action
    actions/shared.ts             helpers the actions share (demo refusal, page refreshes); not
                                  'use server'
    utils/money.ts fees.ts status.ts ledger.ts recurrence.ts meeting.ts ics.ts
          dates.ts redirect.ts app-sections.ts roles.ts contrast.ts session-cache.ts
          invite-code.ts join-view.ts pg-error.ts phone.ts search.ts directory.ts
          apartment-blockers.ts client-ip.ts form.ts payments.ts
    test/db.ts                    PGlite + migrations, per test file
  ui/<area>/*.tsx  ui/skeletons.tsx  ui/web-vitals.tsx
  ui/tokens.ts                    the palette in TypeScript (emails, contrast test)
  ui/button-styles.ts             buttonClassName('primary' | 'secondary') for buttons and links
i18n/ routing.ts request.ts navigation.ts locale.ts      messages/he.json  en.json
drizzle/  (migrations)   scripts/ seed.ts reset-test-db.ts create-building.ts (M7)
proxy.ts                          next-intl routing, NEXT_LOCALE redirect, session-cookie check,
                                  renewal of the session cache cookie
```

`data.ts` and `actions.ts` are split per area because the app has more than a dozen areas;
each file keeps the course's rules.

### Session, authorization and redirects

- `app/lib/session.ts`: `getSession()` wraps `auth.api.getSession({ headers })` in React
  `cache()` (once per request); Better Auth `cookieCache` (5 min) avoids a database read for
  most requests. Server Components cannot write cookies, so `proxy.ts` renews the cache
  cookie: when the session cookie is there and the cache cookie is missing or expired
  (`utils/session-cache.ts` decides, without a database call), it calls `getSession` once
  with `returnHeaders` and forwards its `Set-Cookie` onto the response and the request. A
  revoked session therefore ends within 5 minutes.
- `app/lib/authz.ts`, also `cache()`d: `requireMember()` → `{ userId, buildingId, role,
  apartmentIds, isDemo, timeZone, buildingName }`, or redirects to `/sign-in?next=…` (no
  session) or `/join` (no membership). `requireRole(min)` returns the member or calls
  **`notFound()`** for a lower role (no `forbidden()`: it is experimental and needs a config
  flag; a 404 also hides that the page exists). Actions use `authorizeAction(min, locale)`
  returning `{ message }` instead (the locale is passed in: actions cannot read the route's).
  **Every admin page, data function and action checks its role itself**; the admin layout's
  check only hides navigation (layouts do not re-run on client navigation).
- Every data function takes `buildingId` and filters by it; every action checks that each
  id it receives belongs to the caller's building (composite FKs back this up, §5).
- `?next=` and Better Auth callback URLs pass through `utils/redirect.ts`: only relative
  paths starting with a single `/`, locale kept; Better Auth `trustedOrigins` set.
- **Sign-in:** a Server Action validates the email with Zod, applies `rate-limit.ts`
  (database-backed: 3 per email and 10 per IP per 15 minutes), then calls
  `auth.api.signInMagicLink` with a locale-aware callback. It always continues to
  `/sign-in/check-email`, so it never reveals whether an email exists; a 10-minute httpOnly
  flash cookie (not the URL) tells that page where the link went. Rate-limited requests get a message saying when to try again.
  Better Auth's HTTP endpoint for requesting a link is disabled (`disabledPaths`), so the
  rate limits cannot be bypassed, and link tokens are stored hashed. A failed link returns to
  `/sign-in?error=INVALID_TOKEN` (expired or used) or another code (a general failure).
- **Caching:** building-wide reads (the building row, fee rates, the balance) use
  `'use cache'` keyed by `buildingId`, tagged `building:<id>` (plus `:fees`, `:balance`),
  `cacheLife('hours')`. Nothing per user or per apartment is cached. Every action that writes
  those tables calls `updateTag('building:<id>')`.
- Revalidation targets the locale route: `revalidatePath('/[locale]/…', 'page')`;
  redirects use next-intl's `redirect` so the locale prefix is kept.

## 5. Data model (Postgres, Drizzle)

App ids are `uuid` (default `gen_random_uuid()`); Better Auth is configured to generate uuids
too, so every `userId` FK is `uuid`. Times are `timestamptz`, money is `integer` agorot with
`CHECK (amount > 0)` unless noted, and months are `char(7)` with
`CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$')`. Calendar dates are `date`. FKs are
`ON DELETE RESTRICT` unless noted.
**Composite FKs** keep building scope in the database: `apartments` has
`UNIQUE(id, buildingId)`, and tables that hold both an `apartmentId` and a `buildingId`
reference `(apartmentId, buildingId)`.

| Table | Columns | Constraints and indexes |
|---|---|---|
| `user`, `session`, `account`, `verification` | Better Auth's tables (generated). `user` gains `phone text`, `locale text default 'he'` | as generated |
| `buildings` | id, name, address, timezone, quorumPercent, openingBalanceAgorot (≥ 0), billingStartMonth, isDemo bool, createdAt | `CHECK quorumPercent BETWEEN 1 AND 100` |
| `balance_adjustments` | id, buildingId, amountAgorot (signed, ≠ 0), reason, recordedBy, createdAt | idx buildingId |
| `apartments` | id, buildingId, number text, floor int, billingStartMonth null, createdAt | `UNIQUE(buildingId, number)`, `UNIQUE(id, buildingId)` |
| `building_members` | id, userId **unique**, buildingId, role enum(resident, committee, admin), committeeTitle null, showContact bool default false, committeePhone null, committeeEmail null, createdAt | idx buildingId |
| `apartment_residents` | userId, apartmentId, isOwner bool, createdAt | PK (userId, apartmentId); idx apartmentId |
| `invites` | id, buildingId, apartmentId, codeHash, maxUses (default 6), uses int default 0, createdBy null, expiresAt, revokedAt null | `UNIQUE(codeHash)`; FK (apartmentId, buildingId); createdBy `ON DELETE SET NULL` (an invite outlives the admin who made it); `CHECK uses <= maxUses` |
| `rate_limits` | key text, windowStart timestamptz, count int | PK (key, windowStart); old windows pruned on write |
| `fee_rates` | id, buildingId, apartmentId null (null = default), amountAgorot null (null = the apartment follows the building fee from this month; apartment rows only, `CHECK`), effectiveFrom month, createdBy, createdAt | `UNIQUE NULLS NOT DISTINCT (buildingId, apartmentId, effectiveFrom)`; FK (apartmentId, buildingId); idx (buildingId, effectiveFrom) |
| `payments` | id, buildingId, apartmentId, month, amountAgorot, paidOn date, method enum(cash, transfer, check, bit, other), note, recordedBy, createdAt, voidedAt/voidedBy/voidReason null | FK (apartmentId, buildingId); idx (apartmentId, month), (buildingId, month); `CHECK` void columns all-or-none |
| `expenses` | id, buildingId, category enum, amountAgorot, spentOn date, description, receiptKey null, recordedBy, createdAt, voidedAt/voidedBy/voidReason | idx (buildingId, spentOn) |
| `payment_reminders` | id, buildingId, apartmentId, sentBy, sentAt | FK (apartmentId, buildingId); idx (apartmentId, sentAt desc) |
| `schedules` | id, buildingId, kind enum(cleaning, garden, garbage, recycling, other), title null, weekdays smallint[], intervalWeeks smallint, startsOn date, endsOn null, time time null, notes, createdAt, archivedAt null | `CHECK cardinality(weekdays) > 0 AND weekdays <@ '{0,1,2,3,4,5,6}'`, `CHECK intervalWeeks BETWEEN 1 AND 4`, `CHECK endsOn >= startsOn`; idx buildingId |
| `schedule_exceptions` | id, scheduleId (cascade), date, kind enum(cancelled, moved), movedTo date null, note | `UNIQUE(scheduleId, date)`; `CHECK (kind = 'moved') = (movedTo IS NOT NULL)` |
| `announcements` | id, buildingId, title, body, pinned bool, createdBy, createdAt, archivedAt null | idx (buildingId, pinned desc, createdAt desc, id desc) where archivedAt is null; keyset on (createdAt, id) |
| `parking_spots` | id, buildingId, label, apartmentId null, isGuest bool, notes | `UNIQUE(buildingId, label)`; FK (apartmentId, buildingId); `CHECK NOT (isGuest AND apartmentId IS NOT NULL)` |
| `cameras` | id, buildingId, name, location, kind enum(embed, snapshot), url (secret), minRole enum, sortOrder, createdAt | idx buildingId |
| `meeting_polls` | id, buildingId, title, status enum(open, closed, confirmed), confirmedSlotId null, minutes text null, createdBy, createdAt, closedAt null | partial unique (buildingId) where status = 'open'; `CHECK (status = 'confirmed') = (confirmedSlotId IS NOT NULL)` |
| `meeting_slots` | id, pollId (cascade), startsAt, durationMin (15–600), location | idx pollId |
| `meeting_votes` | slotId (cascade), apartmentId, answer enum(yes, maybe, no), userId, updatedAt | PK (slotId, apartmentId); idx apartmentId |

Writes touching more than one row run in a transaction (invite redemption, multi-month
payments, confirming a meeting with its announcement). The brief's `rrule` becomes explicit
columns (`weekdays`, `intervalWeeks`, `startsOn`, `endsOn`), which cover every building
schedule without a recurrence library. Vote actions check slot → poll (open) → building and
that the apartment is one of the voter's.

## 6. Routes and screens

Paths are the Hebrew (unprefixed) form; English adds `/en`. Every page has `loading.tsx`
(skeleton of its final layout) and an `error.tsx` (using the `retry` prop) with a retry;
every list has an empty state that explains and offers the next action (to the committee)
or says when to expect content (to residents). Pages a role cannot see return 404.

### Public

| Route | Job | Primary action | States | Read / write | Phone / desktop |
|---|---|---|---|---|---|
| `/sign-in` | Get a magic link | "Send me a link" | idle, pending, invalid email, rate-limited (with retry time), send failure; `?error=INVALID_TOKEN` (expired or used link) or another code (failure); `?signedOut=1` and a failed sign-in focus the field (an expired link's notice does not) | write `actions/auth.requestMagicLink` | centered card; desktop adds a warm illustration panel at the start side |
| `/sign-in/check-email` | Confirm the link was sent, and to which address | "Use a different email" | with the flash cookie (Zod-checked) the address; without, a general sentence | — | same card |
| `/join/[code]` (M2) | Redeem an invite | "Join apartment 7" | valid, expired, full, revoked, already a member, member of another building, signed out (sign in, then return) | read `data/invites.preview`; write `actions/invites.redeem` | card |
| `/join` (M2) | Enter a code by hand | "Join" | invalid code, rate-limited | same | card |
| `/welcome` (M7) | Explain Lobbie to a visitor | "Sign in" / "Try the demo" (resident or committee) | static | write `actions/demo.signInAsDemo` | hero + 3 feature rows; 2 columns on desktop |

### Resident (all members)

| Route | Job | Primary action | States | Read / write | Phone / desktop |
|---|---|---|---|---|---|
| `/` Home | Five-second overview | the most urgent item (pay / vote / none) | Suspense per card group, not billed yet, empty week, reminder banner, poll open | `data/payments.statusForUser`, `data/ledger.balance`, `data/schedules.nextPerKind`, `data/announcements.latest`, `data/meeting.openPoll` | stacked cards, status + balance first; desktop 2-column grid |
| `/money` | My apartment's payments | — (status is the point) | paid, due, overdue, partial (what's left), not billed, no fee, empty history, no apartment, several apartments (`?apartment=`, the first by default; an apartment not the person's → 404) | `data/payments.monthlyStatus` (this year's months, after any earlier one still owed and before any later one paid ahead), `history` (every payment, newest paid first, voided ones with when and why; never who recorded or voided, nor the committee's note), `data/apartments.mine` | apartment choice, then status hero beside the month list; history as a list on phones, a table on desktop |
| `/money/balance` | Where the money goes | open a receipt | opening balance only, `?year=` | `data/ledger.balance`, `byCategory`, `data/expenses.list` | balance figure, CSS category bars (no chart library), expense list |
| `/schedule` | What happens this week | prev/next week (`?week=YYYY-MM-DD`, a Sunday) | empty week, cancelled/moved marked | `data/schedules.occurrences(range)` | phone day list; desktop 7 columns |
| `/building` | Hub | open a section | cameras link only if any visible | `data/cameras.visibleCount` | link list; desktop shows the latest announcements beside it |
| `/building/announcements` | Read posts | "Load more" (`?before=` cursor) | empty, pinned first | `data/announcements.feed` | single column, 65ch |
| `/building/directory` | Who lives where | search (`?q=`, debounced) | no results, contact hidden | `data/directory.list` (never selects hidden contacts) | grouped by floor; cards, grid on desktop |
| `/building/committee` | Who runs the building | call / email | no committee yet, no published contact | `data/directory.committee` | cards |
| `/building/parking` | Who parks where | — | my spots first, guest spots, none yet | `data/parking.list` | grouped list; desktop grid |
| `/building/cameras` | Live views | refresh a snapshot | none visible → 404, one failing → inline error with retry | `data/cameras.listVisible` (embed URLs only for allowed roles; snapshot URLs never selected) | 1 column phone, 2 columns desktop, 16:9 |
| `/meeting` | Vote and see the result | mark each slot | no poll, open, closed, confirmed (+ calendar, minutes), two apartments (`?apartment=`) | `data/meeting.current`, `ranking`; `actions/meeting.vote` (save on change, `useOptimistic`) | slot cards; desktop table with tallies |
| `/more` | Phone menu: profile, language, sign out | — | admin link for committee | session role | list; on desktop the same list, reached from the side nav (no redirect: it would need client code and break shared links) |
| `/profile` | Me and settings | "Save" | saved, validation errors, demo (read-only) | `data/users.me`; `actions/users.*` | 1-column form |

### Admin section (`/admin`, committee and admin; ★ admin only)

| Route | Job | Primary action | Read / write |
|---|---|---|---|
| `/admin` | Overview: who's behind and by how much (its own Suspense and error boundary), quick links | "Record a payment" (to `/admin/payments`) | `data/payments.arrears` (the grid's one query) |
| `/admin/building` ★ | Building details, balance adjustments | Save | `data/buildings.get` / `actions/buildings.update`, `addAdjustment` |
| `/admin/apartments` ★ | Apartments and invites | Add apartment; "Create invites for all" | `data/apartments.list` / `actions/apartments.*`, `actions/invites.createAll` |
| `/admin/apartments/[id]` ★ | One apartment: residents, invite, monthly fee, payments | Create invite | `data/apartments.get`, `residentsOf`, `data/invites.forApartment`, `data/fees.forApartment`, `data/payments.forApartment` / `actions/invites.create`, `revoke`, `actions/residents.setOwnership`, `removeFromApartment`, `actions/fees.setOverride`, `followBuilding`, `actions/payments.record`, `voidPayment` |
| `/admin/people` ★ | Everyone in the building: role, title, apartments | Change role | `data/members.list` / `actions/members.setRole`, `removeFromBuilding` |
| `/admin/fees` | Building fee and overrides | Set fee from month | `data/fees.list` / `actions/fees.setDefault` |
| `/admin/payments` | Apartment × month grid (`?year=`, from the earliest billing start to a year ahead), arrears, and the apartment opened from either (`?apartment=`): record, void, remind | Record payment (in the open apartment) | `data/payments.grid`, `data/payments.forApartment` / `actions/payments.record`, `voidPayment`, `actions/reminders.send` |
| `/admin/expenses` | Expenses with receipts | Add expense | `data/expenses.list` / `actions/expenses.record`, `void` |
| `/admin/schedules` | Schedules and exceptions | New schedule | `data/schedules.list` / `actions/schedules.*` |
| `/admin/announcements` | Posts | New post | `data/announcements.adminList` / `actions/announcements.*` |
| `/admin/parking` | Spots | Add spot | `data/parking.list` / `actions/parking.*` |
| `/admin/cameras` ★ | Cameras | Add camera | `data/cameras.adminList` (URL masked) / `actions/cameras.*` |
| `/admin/meetings`, `/admin/meetings/[id]` | Polls | New poll / Confirm slot | `data/meeting.*` / `actions/meeting.*` |

Admin pages: phone = one column, tables become cards; desktop = table with a toolbar. Short
forms open in a Radix Dialog; long ones (schedules, expenses, polls) are pages.
Destructive actions confirm in a Radix AlertDialog.

### Navigation

- Phone (< 1024 px): bottom tab bar (Home `/`, Money `/money`, Schedule `/schedule`,
  Building `/building`, More `/more`), icons + labels, 56 px + safe-area inset, active item
  `aria-current="page"` in accent. Top bar: building name, language switch.
- Desktop (≥ 1024 px): side nav at the inline-start edge with every resident route, then an
  "Admin" group for committee; content max 72rem.
- Items appear when their milestone lands; nothing links to a page that does not exist yet.

## 7. Design tokens (warm and neighbourly)

Rubik (variable, `hebrew` + `latin` + `latin-ext` subsets, all preloaded: `latin-ext` holds
the ₪ the browser draws from it) for everything; `tabular-nums` for money and dates. Type
scale 1.25 (14, 16, 20, 25, 31; display `clamp(2rem, 1.5rem + 2.5vw, 3rem)` for the status
card's amount; the balance figure is smaller, 25). Spacing 4 px grid. Radii: card 12 px,
control 10 px, chip 999 px. Shadow `--shadow-card: 0 1px 2px rgb(31 27 22 / .06), 0 4px 12px
rgb(31 27 22 / .05)` (none in dark; a border instead). Motion 180 ms ease-out; none under
`prefers-reduced-motion`.

| Token | Light | Dark | Contrast on surface |
|---|---|---|---|
| `--color-surface` | `#FBF8F3` | `#16130F` | — |
| `--color-surface-raised` | `#FFFFFF` | `#221D18` | — |
| `--color-border` | `#E7E0D6` | `#3A332B` | decorative |
| `--color-text` | `#1F1B16` | `#F3EEE7` | 16.2 / 16.0 |
| `--color-text-muted` | `#6B6259` | `#B3A89B` | 5.6 / 7.9 |
| `--color-accent` (buttons, links, focus) | `#B54E29` | `#E07A52` | 4.9 / 6.2 |
| `--color-accent-strong` (hovered, pressed button) | `#9A4222` | `#E8916F` | on-accent 6.6 / 7.7 |
| `--color-on-accent` | `#FFFFFF` | `#16130F` | 5.1 / 6.2 |
| `--color-success` (paid) | `#2F7A4F` | `#5FB384` | 4.9 / 7.3 |
| `--color-warning` (due, text) | `#8A5A12` | `#E0A94A` | 5.6 / 8.8 |
| `--color-warning-fill` (chips, bars) | `#B7791F` | `#E0A94A` | non-text 3.4 |
| `--color-danger` (overdue) | `#B23A3A` | `#EC7B7B` | 5.6 / 6.8 |
| `--color-danger-strong` (hovered, pressed) | `#973131` | `#F09393` | on-accent 7.5 / 8.2 |

(The brief's `#C2562F` is exactly 4.50:1 on white; `#B54E29` keeps the colour with margin.)
Status is never colour alone: every chip has a word and an icon. Focus ring: 2 px accent
outline, 2 px offset. Directional icons flip with `rtl:-scale-x-100`.

## 8. Performance budgets

| Metric | Budget |
|---|---|
| Lighthouse Performance / A11y / Best Practices / SEO (mobile, prod build) | ≥ 95 / 100 / 100 / 100 (SEO on public pages; app pages are `noindex`) |
| LCP | ≤ 2.0 s |
| CLS | ≤ 0.05 |
| TBT | ≤ 150 ms |
| First-load JS per route (module scripts, gzip; the `noModule` polyfill excluded) | ≤ 165 kB total, of which ≤ 30 kB is Lobbie's own code (everything beyond the React/Next runtime shared by every route). Rebased in M1: React 19 + Next 16 alone are ~138 kB, so the original 110/130 kB could not be met; decided by the user on 2026-11-03 |
| axe violations | 0 (every route, both languages; Home in both themes) |
| Console errors in e2e | 0 |
| Server p95 (local, warm) | ≤ 200 ms reads, ≤ 400 ms writes; the observer reports the Neon round trip (Israel → Frankfurt) separately, and a miss caused only by it is noted, not hidden |
| 5xx in the e2e log | 0 |

## 9. Observability

- `app/lib/logger.ts`: JSON lines; data functions and actions log failures once at the
  boundary; no bare `console.log`. Data functions log their `area` (`data/payments`) and
  throw a short "Failed to load …", after `unstable_rethrow(err)` so Next's own signals (an
  ended prerender, a redirect) are not logged as failures; actions and route handlers log
  their `route`.
- `app/ui/web-vitals.tsx` (`useReportWebVitals`) logs LCP, CLS and INP from M1; at launch it
  also feeds Vercel Analytics.
- Production (M7): Vercel Web Analytics, Speed Insights, runtime logs.

## 10. Testing strategy

- **Pure logic** (`utils/*`): Vitest, test-first, table-driven.
- **Data and actions:** Vitest in a `node` environment on PGlite with the real migrations,
  a fresh database per test file. `app/lib/db.ts` exports `db` typed as a shared
  `Db = PgDatabase<PgQueryResultHKT, typeof schema>`; tests `vi.mock('@/app/lib/db')` with
  the PGlite instance. `server-only` is aliased to an empty module in Vitest. Session and
  authz are mocked to a given member. Every action has authorization tests: lower roles
  rejected, other buildings' ids rejected, demo buildings refused.
- **Components:** Testing Library for behaviour.
- **e2e:** Playwright against `next start` with `DATABASE_URL` = `E2E_DATABASE_URL`,
  `BETTER_AUTH_URL=http://localhost:3100`, `MAIL_TRANSPORT=outbox`; `globalSetup` runs
  migrate + reset + seed (the reset script refuses when `E2E_DATABASE_URL` is missing or
  equals `DATABASE_URL`). `workers: 1` (one shared database); tests that write use their
  own seeded apartments (`e2e-*`) so read assertions stay stable; the outbox is read by
  recipient. `e2e/a11y.spec.ts` runs axe on every route; a phone project (360 × 780).
  Every milestone's demo flow is an acceptance spec.
- **CI:** format, lint, types and `npm test` (PGlite needs no database); build and e2e run
  locally and are reported in each PR.

## 11. Out of scope (v1)

Issue reports; general polls; documents library; online payments; notifications beyond the
magic link; PWA; several buildings per user; management companies; chat; HLS streams;
bank/CSV import; self-serve "create a building" sign-up (`scripts/create-building.ts` at
launch); editing payments or expenses (void and re-record).

## 12. Time estimate

From the plan: **about 13 hours of agent time and about 2 hours of yours** across 7
milestones and 40 tasks; range 10 h best, 13 h likely, 19 h worst, plus the time PRs wait
for your merge.

Assumptions: each milestone's reviews converge in one or two rounds; the Neon project
exists before M1's database task; your PR reviews take about 15 minutes each.

Biggest risks: Better Auth + Cache Components + next-intl together in M1 (new combination);
the PGlite/postgres-js shared typing in M1; the SSRF-safe snapshot fetch in M5; launch
setup in M7 depends on your Vercel, DNS and Resend access.
