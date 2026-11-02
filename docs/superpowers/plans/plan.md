# Lobbie — implementation plan

Spec: `docs/superpowers/specs/design.md` · Architecture: `docs/adr/0001-architecture.md` ·
Requirement IDs (R1–R40) refer to the spec's checklist.

## Global constraints

Every implementer and reviewer brief carries, verbatim: "Follow
`.claude/skills/stack-conventions/SKILL.md` and the stack files the spec names,
`.claude/skills/ui-craft/SKILL.md` for any UI, and `.claude/skills/quality-gates/SKILL.md`.
Server data is never copied into client state; view state lives in the URL; data is read
and written through the layer the spec names. Any `any`, unjustified dependency, missing
state (loading, empty, error), missing keyboard or focus support, or leftover log or dead
code is an Important finding."

Stack files: `stack-conventions/SKILL.md`, `nextjs.md`, `sql.md`, `styling.md` (Tailwind).

- **Read the docs first:** before any Next.js API, the matching guide in
  `node_modules/next/dist/docs/`. In particular: `01-app/02-guides/authentication-with-cache-components.md`,
  `internationalization.md`, `instant-navigation.md` (partial prefetching is on), `forms.md`,
  `server-actions.md` and `content-security-policy.md`. Before using next-intl and Better Auth
  APIs, read their current docs through context7.
- **Reads** run in Server Components through `app/lib/data/<area>.ts`.
- **Writes** go through Server Actions in `app/lib/actions/<area>.ts`, in this order:
  `authorizeAction(minRole)`, then Zod `safeParse`, then the demo-building refusal, then a
  check that every id belongs to the caller's building, then the write in a `try/catch`, then
  `revalidatePath('/[locale]/…', 'page')`, then next-intl's `redirect`, outside the try/catch.
- **Authorization is checked where the data is**, never only in a layout: every page,
  data function and action checks its role. Use `notFound()` for a role that is too low.
- **Every query filters by `buildingId`.** No N+1. Transactions for multi-row writes. Money
  in integer agorot (sums cast and parsed with Zod); months `YYYY-MM`; `timestamptz`.
- **RTL:** logical Tailwind utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`); no `left`/`right`/`ml`/`mr`; directional icons flip with
  `rtl:-scale-x-100`. Every string is in `messages/he.json` and `messages/en.json`.
- **Cache Components:** session-dependent reads inside `<Suspense>` with a skeleton matching
  the final layout; nothing user-specific in `'use cache'`. `getSession`/`requireMember` are
  wrapped in React `cache()`.
- **Locale:** `i18n/request.ts` reads it with `next/root-params` (`hasLocale`, else
  `notFound()`), so pages stay static with no `setRequestLocale` (next-intl 4.14 deprecates
  it); server code calls `getLocale()`/`getTranslations()` with no locale argument.
  `localeDetection: false`: Hebrew whatever the browser's language; `proxy.ts` sends an
  unprefixed URL to `/en` only when the `NEXT_LOCALE` cookie is `en`, and writes the cookie
  on every page load. A language switch sets the cookie to the locale it moves to.
- **Client components** only for leaves (forms with `useActionState`, save-on-change
  controls, nav active state, language switch, snapshot refresher, web vitals).
- **Tests** never touch the Neon `dev` branch. Data tests use PGlite; e2e uses
  `E2E_DATABASE_URL`, reset and seeded per run, `workers: 1`, writes on `e2e-*` apartments.
- **Secrets** live only in `.env.local`; Claude never reads or prints it. `.env.example`
  lists every variable with a placeholder.

### Dependencies and patterns (each with its reason)

| Addition | Where | Why |
|---|---|---|
| `drizzle-orm`, `drizzle-kit` | `app/lib/db.ts`, `schema.ts`, `drizzle/` | 20 tables, migrations and typed queries (`sql.md`) |
| `postgres` (`^3.4.9`) | `app/lib/db.ts` | The course's driver; TCP supports interactive transactions on Neon. Stays on 3.4: 4.0.0 was four days old at M1 |
| `@electric-sql/pglite` (dev) | `app/lib/test/db.ts` | Real Postgres in-process for data tests: isolated, fast, no network, runs in CI |
| `better-auth`, `auth` (dev) | `app/lib/auth.ts`, `/api/auth/[...all]` | Stable magic-link auth with a Drizzle adapter (ADR 0001); `auth` is Better Auth's CLI, which generates its tables (`@better-auth/cli` is deprecated at 1.4.21) |
| `next-intl` | `i18n/`, `proxy.ts`, `app/[locale]/layout.tsx` | he/en routing, RTL, ICU messages; its `NextIntlClientProvider` is the only context, given only the messages client components need |
| `tsx` (dev) | `scripts/*.ts` | Runs TypeScript scripts with the `@/` alias, outside Next.js |
| `@axe-core/playwright` (dev) | `e2e/a11y.spec.ts` | The `metrics` accessibility gate |
| `resend` (M7) | `app/lib/mail.ts` | Production magic-link email |
| `@vercel/blob` (M7) | `app/lib/storage.ts` | Production receipt storage (server-side `put`; uploads stay ≤ 4 MB through the action) |
| `@vercel/analytics`, `@vercel/speed-insights` (M7) | root layout | Production analytics and real-user vitals |

**Route Handlers.** Each one is called by something other than this app's own forms:
- `/api/auth/[...all]`: the magic link in the email.
- `/api/files/[id]`: an `<a>` or `<img>` has to GET a receipt.
- `/api/cameras/[id]/snapshot`: an `<img>` has to GET it. It also hides the camera URL and
  its credentials, and avoids mixed content.
- `/api/meetings/[id]/ics`: calendar apps download it.

**No** `useReducer`, Zustand, TanStack Query or Form, or app-level context. The snapshot
refresher (M5) uses `useEffect` to stay in sync with a timer and the page's visibility,
both outside React.

### Configuration changes (approved with this plan)

- `next.config.ts`:
  - the next-intl plugin (M1);
  - `experimental.serverActions.bodySizeLimit: '5mb'` (M3, receipts), or the key the
    installed docs name;
  - security headers and a CSP **without nonces** (M7). Nonces would force dynamic
    rendering and disable the static shell and partial prefetching, per the installed CSP
    guide. `frame-src` is `'none'` except on `/building/cameras`, which allows `https:`;
    embeds are sandboxed.
- `playwright.config.ts` (M1):
  - `globalSetup`: migrate, reset and seed the test branch;
  - `webServer.env`: `DATABASE_URL` from `E2E_DATABASE_URL`, `BETTER_AUTH_URL=http://localhost:3100`,
    `MAIL_TRANSPORT=outbox`;
  - `workers: 1`;
  - a phone project (360 × 780).
- `vitest.config.mts` (M1): `include` adds `{scripts,i18n,messages}/**/*.test.ts`; `node`
  environment for `app/lib/**`; `server-only` aliased to an empty module.
- `package.json` scripts (M1): `db:generate`, `db:migrate`, `db:seed`, `db:studio`,
  `auth:generate`.
- `.github/workflows/ci.yml` (M1): add `npm test` (approved in discovery).

## Your setup before M1's task 3 (about 5 minutes)

1. In Vercel: **Storage → Create Database → Neon (Serverless Postgres)**, named `lobbie`,
   region Frankfurt (`fra1`, closest to Israel), free plan. No Vercel project needs to be
   connected yet. (The Neon project is created and billed through Vercel; M7 connects it to
   the app's Vercel project, and its `main` branch becomes production.)
2. From the database page, **Open in Neon** → Branches: create `dev` and `test` from `main`.
   Then `! cp .env.example .env.local` and paste each branch's **pooled** connection string
   into `DATABASE_URL` (`dev`) and `E2E_DATABASE_URL` (`test`).
3. Run `! echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local`.

---

## M1: Foundation and the five-second Home (`m1-foundation`)

The thinnest end-to-end slice. A seeded resident signs in by magic link and sees, in Hebrew
or English, whether their apartment is paid up and how much the building has.
Requirements: R1, R2 (the tabs that exist), R3, R4, R5, R6 (core), R37 (web vitals logged),
and part of R25.

1. **Design tokens, fonts and instrumentation** (medium).
   - Tokens in `app/globals.css` under `@theme`, as spec §7 (light and dark).
   - Rubik through `next/font` (hebrew and latin subsets).
   - `app/lib/logger.ts` and `app/ui/web-vitals.tsx`.
   - Delete the greeting example: `app/page.tsx`, `app/ui/greeting-form.tsx`,
     `app/lib/actions.ts` and its test, and `e2e/greeting.spec.ts`.
   - The CI and Vitest config changes listed above.
   - Tests: a logger unit test, and a token contrast test (the pairs from §7, computed).
2. **i18n, routing and proxy** (medium).
   - `i18n/routing.ts` (`he` default, `en`, `as-needed`, `localeDetection: false`, a one-year
     `NEXT_LOCALE` cookie), `request.ts` (locale from `next/root-params`), `navigation.ts`,
     and the messages files.
   - `app/[locale]/layout.tsx` (the root layout) with `lang`, `dir` and
     `generateStaticParams`; the locale from `getLocale()`, no `setRequestLocale`. Delete
     `app/layout.tsx`; add `app/not-found.tsx` with its own `<html>`, and a
     `[locale]/[...rest]` page that calls `notFound()` for the localized 404.
   - `proxy.ts`: next-intl, plus the cookie redirect to `/en` and writing the cookie, with
     the matcher excluding `api`, `_next` and files.
   - `app/lib/utils/redirect.ts`: safe `next` paths.
   - Tests: a messages-parity test (the same keys in he and en); `redirect.ts` unit tests
     (`//evil`, absolute URLs, the locale kept); e2e: `/` is `dir="rtl"` in an English
     browser, `/en` is `dir="ltr"`, the cookie redirect, and the 404s.
3. **Database layer** (large).
   - A minimal `app/lib/auth.ts` (Drizzle adapter, the magic-link plugin, `additionalFields`
     `phone` and `locale`, uuid ids). `auth:generate` turns it into the auth tables.
   - `app/lib/schema.ts` for M1's tables: buildings, balance_adjustments, apartments,
     building_members, apartment_residents, rate_limits, fee_rates, payments, expenses, and
     the auth tables. Composite FKs as in spec §5.
   - `drizzle.config.ts`, the first migration, `app/lib/db.ts` (exports the `Db` type) and
     `app/lib/test/db.ts` (PGlite).
   - `scripts/seed.ts`, idempotent, a demo building ("רחוב הרימון 12", `isDemo`): 12
     apartments on 4 floors plus `e2e-1..3`; 16 residents, including 2 committee members and
     1 admin; a year of payments, with 2 apartments behind; 15 expenses.
   - `scripts/reset-test-db.ts`, with the guards from spec §10.
   - Tests on PGlite: constraints (duplicate apartment number, negative amount, bad month,
     void columns all-or-none, a cross-building apartment FK, one building per user); the
     seed run twice; the reset guard.
4. **Money logic** (medium, TDD).
   - `app/lib/utils/money.ts`: format agorot per locale; parse shekel input to agorot.
   - `utils/fees.ts`: the fee in force for an apartment and month.
   - `monthStatus`: paid, due, overdue, not billed, and the amount remaining; uses the
     apartment's billing start and the current month in the building's time zone.
   - `balance`.
   - `data/payments.statusForApartments` and `data/ledger.balance`, one query each, with
     sums cast.
   - Tests: table-driven unit tests, covering a fee change mid-year, a partial payment, a
     voided payment, an apartment added late, a month boundary at 23:30 Israel time, and a
     balance adjustment; data tests on PGlite.
5. **Auth** (large).
   - Complete `app/lib/auth.ts`: 15-minute links, `trustedOrigins`, `cookieCache`, an email
     in the user's locale. Add `/api/auth/[...all]`.
   - `app/lib/mail.ts`: the outbox transport, behind `MAIL_TRANSPORT` and the `VERCEL_ENV`
     guard.
   - `app/lib/rate-limit.ts`.
   - `app/lib/session.ts` and `app/lib/authz.ts`, wrapped in `cache()`.
   - `actions/auth.requestMagicLink`, the sign-in page and the check-email page (with
     `useActionState`, field errors, pending and rate-limited states), and sign-out.
   - The proxy redirects to `/sign-in?next=` when `getSessionCookie` finds no session
     cookie. A user with no membership sees `/join`'s "ask your committee for an invite"
     message; the code form lands in M2.
   - Tests: `rate-limit` (the window, per email, per IP); the mail guard (it throws with
     `VERCEL_ENV`); authz (no session, no membership, role order, `notFound`); sign-in
     action validation; the action always reaching check-email.
6. **App shell and Home** (large).
   - `app/[locale]/(app)/layout.tsx` with:
     - a top bar: the building name and a language switch that keeps the path;
     - bottom tabs on phones and a side nav from 1024 px, with Home and More, `aria-current`
       and safe-area padding;
     - `/more`, with language and sign-out;
     - `app/ui/skeletons.tsx`.
   - Home:
     - a status card (this month, the amount remaining, months behind) and a balance card,
       each in `<Suspense>`;
     - `loading.tsx` and `error.tsx` (with `retry`);
     - a not-billed-yet empty state.
   - e2e: the fixtures (sign in through the outbox, by recipient), the `playwright.config.ts`
     changes, and `e2e/a11y.spec.ts`.
   - Tests: nav active state (Testing Library).
   - Acceptance tests:
     - `e2e/sign-in.spec.ts`: request a link, open it, land on Home; plus an unknown email
       still reaching check-email, and a `next=` round trip;
     - `e2e/home.spec.ts`: a paid resident sees "paid"; a resident who is behind sees
       "overdue" and the amount; the balance matches the seed; in he and en, on phone and
       desktop;
     - axe on sign-in and Home.

**Demo flow:** open `/sign-in` → enter a seeded resident's email → open the link from the
outbox → Home in Hebrew (RTL) shows status and balance → switch to English → dark mode.

## M2: The building and its people (`m2-building`)

Requirements: R6–R13.

1. **Admin section and building details** (medium).
   - The `/admin` layout (committee and up) and the admin nav group.
   - `/admin/building` ★: a details form and balance adjustments (a list, plus "Add
     adjustment" with a reason).
   - Tests: authz on each action (residents and committee rejected, admin allowed, demo
     refused); the adjustment showing in `ledger.balance`.
2. **Apartments** (medium). `/admin/apartments`: list, add, edit and remove, with the
   apartment's billing start. Removing is blocked while the apartment has residents or
   payments, and the page says why. Tests: actions, including a duplicate number and a
   cross-building id.
3. **Invites and joining** (large).
   - Schema `invites`.
   - `/admin/apartments/[id]`: create, copy the link, revoke.
   - "Create invites for all apartments", with a copyable list (apartment → link).
   - `/join/[code]` and `/join`: redemption, atomic and in a transaction, covering every
     state in spec §6. Code entry is rate-limited, and a signed-out user signs in first and
     comes back.
   - Tests: redeeming an expired, full, revoked, already-joined or other-building invite;
     concurrent redemption of the last use.
4. **People and roles** (medium). `/admin/people` ★ (role, committee title, remove from the
   building) and the residents list on `/admin/apartments/[id]` (owner or tenant, remove from
   the apartment). Tests: the last-admin guard; role-change authz.
5. **Directory and committee** (medium).
   - The `/building` hub (the Building tab appears).
   - `/building/directory`: grouped by floor, `?q=` search with a debounce.
   - `/building/committee`.
   - Tests: a data test that hidden contacts are never selected; an empty search.
6. **Profile and settings** (medium). `/profile` (and `/more` links to it):
   - name and phone;
   - directory contact visibility and language, both with the save-on-change pattern;
     language is saved to the profile and the cookie;
   - the committee contact, for committee members only.
   - Tests: actions; Testing Library for the toggle, including reverting when it fails.
- **Acceptance tests:**
  - `e2e/invite.spec.ts`: the admin creates an invite for `e2e-1`, a new user signs in from
    the link, joins and sees Home;
  - `e2e/directory.spec.ts`: a resident opts in, their phone appears; a committee member
    publishes a contact, it appears on the committee page;
  - axe on the new routes.

**Demo flow:** admin creates invites for all apartments → a new resident opens one link,
signs in and joins → opts in to show their phone → appears in the directory.

## M3: Money (`m3-money`)

Requirements: R14–R19, and part of R25.

1. **Fees** (medium). `/admin/fees` sets the building default and per-apartment overrides,
   each effective from a month, and shows the history. Tests: validation (a positive amount,
   a month not before billing start); a data test that earlier months keep the old fee.
2. **Recording and voiding payments** (medium-large).
   - `actions/payments.record`: one or several months, split per month in one
     transaction, and never more than is owed.
   - `actions/payments.void`, with a reason.
   - The record dialog (amount pre-filled with what is owed) and the void AlertDialog.
   - Tests: multi-month atomicity; overpayment rejected; voiding restores `overdue`; authz;
     demo refused.
3. **Committee grid and overview** (medium).
   - `/admin/payments`: the apartment × month grid (`?year=`) with status chips, and the
     arrears list.
   - `/admin` opens on the arrears overview and quick links.
   - Tests: the grid query for a full year in one query (no N+1).
4. **Resident Money page** (medium). `/money`: a status hero, a month list and the history,
   with `?apartment=` when there are several (the Money tab appears). Tests: data tests for
   history order.
5. **Storage and expenses** (large).
   - `app/lib/storage.ts`: the local driver; keys, not paths; magic-byte type check; 4 MB.
   - `/api/files/[id]`: members of that building only, with `nosniff`,
     `Cache-Control: private` and PDFs as attachments.
   - `/admin/expenses`: record with a receipt, and void.
   - The `bodySizeLimit` config change.
   - Tests: storage unit tests; a route test that another building's member gets 404; a
     disguised file rejected.
6. **Balance page** (medium). `/money/balance`: the balance figure, income and expenses,
   CSS bars by category (`?year=`), and the expense list with receipt links. Tests: category
   sums with voided rows and adjustments.
- **Acceptance tests:**
  - `e2e/payments.spec.ts`: the committee records a payment for `e2e-2` (overdue → paid);
    voids it (back to overdue);
  - `e2e/expenses.spec.ts`: adds an expense with a receipt, the balance drops, the receipt
    opens;
  - `e2e/money.spec.ts`: a resident's history in he and en;
  - axe on the new routes.

**Demo flow:** the committee records a payment for an apartment that is behind (it turns
paid) → adds an expense with a receipt (the balance drops) → the resident's Money page shows
the history.

## M4: Life in the building (`m4-life`)

Requirements: R20–R25.

1. **Recurrence** (medium, TDD). `app/lib/utils/recurrence.ts` lists a schedule's
   occurrences in a date range: weekdays, every N weeks from `startsOn`, until `endsOn`, with
   exceptions cancelling or moving a date. It works on calendar dates in the building's time
   zone. Tests: table-driven, including biweekly across a month boundary, a moved occurrence
   coming into the range, and the DST week.
2. **Schedules admin** (medium). `/admin/schedules`: create, edit and archive, plus
   exceptions with a note. Tests: validation (weekdays non-empty, interval 1–4, end after
   start); authz.
3. **Schedule page** (medium). `/schedule?week=`: a day list on phones and a 7-column week
   on desktop; cancelled and moved dates are marked with a word and an icon. The Schedule tab
   appears. Tests: the week parameter is normalised to a Sunday, and invalid values fall back
   to this week.
4. **Announcements** (medium). `/admin/announcements` (write, pin, archive) and
   `/building/announcements` (pinned first, keyset "Load more" on `(createdAt, id)`).
   Tests: pagination with equal timestamps.
5. **In-app reminders** (medium). `actions/reminders.send`, rate-limited to one per
   apartment per 7 days; the button is disabled and shows the next date. A banner on Home and
   `/money` while the month is overdue. Tests: the rate limit; the banner clears once the
   month is paid.
6. **Home "this week"** (medium). A week strip with the next date for each kind, the latest
   and pinned announcements, and the reminder banner, each group in its own Suspense.
- **Acceptance tests:**
  - `e2e/schedule.spec.ts`: "no cleaning on Sukkot" shows, and week navigation works;
  - `e2e/announcements.spec.ts`: a post is pinned and tops the feed and Home;
  - `e2e/reminders.spec.ts`: the committee reminds `e2e-3`, the resident sees the banner;
  - axe on the new routes.

**Demo flow:** the committee creates a biweekly gardening schedule and cancels one date →
the week view and Home show it → it posts and pins an announcement → it reminds an apartment
that is behind → that resident sees the banner.

## M5: Parking and cameras (`m5-parking-cameras`)

Requirements: R26–R28.

1. **Parking admin** (medium). `/admin/parking`: spots, assigning an apartment, and guest
   spots. Tests: the guest/assigned constraint; authz.
2. **Parking page** (small). `/building/parking`: my spots first, then by label, with guest
   spots marked. Tests: a data test for the ordering.
3. **Cameras admin** (medium). `/admin/cameras` ★ sets the name, location, kind, URL,
   minimum role and the shared-areas notice. The URL field is write-only: it shows masked
   after saving. Tests: URL validation (`https` for embeds, `http(s)` for snapshots); authz;
   a data test that resident queries never select `url` for snapshots or for roles below the
   minimum.
4. **Safe fetch** (medium, TDD). `app/lib/safe-fetch.ts`:
   - resolves DNS and rejects loopback, private, link-local, CGNAT and IPv6 ULA addresses,
     both for the first URL and for every redirect hop (at most 3);
   - connects to the resolved IP, with the Host header kept, so DNS rebinding cannot change
     it;
   - moves `user:pass@` credentials into an `Authorization` header;
   - a 5 s timeout, a 5 MB cap and `image/*` only;
   - `SAFE_FETCH_ALLOW_HOSTS`, for tests only, refused when `VERCEL_ENV` is set.
   - Tests: each blocked range, a redirect to a private address, credentials, a timeout, the
     size cap, the content type.
5. **Cameras page and snapshot proxy** (large).
   - `/building/cameras`: 404 when no camera is visible, and the nav and hub link are hidden.
   - Embeds in a sandboxed iframe.
   - `/api/cameras/[id]/snapshot`: a role check, then safe fetch, with
     `Cache-Control: no-store`.
   - A client refresher every 10 s while the page is visible, with an inline error and
     retry.
   - Tests: route tests (a role that is too low gets 404; a non-image gets 502).
- **Acceptance tests:**
  - `e2e/cameras.spec.ts`: a local test image server (allowlisted) serves the snapshot; a
    resident sees it refresh; a camera that needs the committee role is hidden from them;
  - `e2e/parking.spec.ts`: the resident's spot is listed first;
  - axe on the new routes.

**Demo flow:** the admin adds a lobby snapshot camera visible to residents → a resident
opens Building → Cameras and watches it refresh → the parking list shows their spot first.

## M6: Annual meeting (`m6-meeting`)

Requirements: R29–R33, and part of R25.

1. **Ranking and quorum** (small, TDD). `app/lib/utils/meeting.ts`, following the spec's
   rules. Tests: table-driven tie-breaks, and quorum at 49, 50 and 51 %.
2. **Poll admin** (medium). `/admin/meetings` and `/admin/meetings/[id]`: create a poll,
   add and remove slots while it is open, close it, and confirm it (one transaction: the
   status, the confirmed slot and the announcement). Tests: one open poll per building;
   confirming needs a closed poll; the CHECK constraint; authz.
3. **Voting and ranking** (large). `/meeting`:
   - slot cards with yes / maybe / no as a Radix radio group, saved on change with
     `useOptimistic`; a failure reverts and shows an `aria-live` message;
   - `?apartment=` for someone in two apartments;
   - the ranking, with tallies and quorum badges.
   - Tests: Testing Library for the control; action tests (the vote is per apartment; slot →
     poll open → building; demo refused).
4. **Calendar file** (small). `/api/meetings/[id]/ics` (members only, confirmed polls)
   using `utils/ics.ts`. Tests: the ICS text, including escaping, UTC times and CRLF.
5. **Minutes and the Home card** (medium). A minutes editor on the admin page and the
   minutes on `/meeting`. A Home card: "Vote" for an open poll, "Add to calendar" once
   confirmed. Tests: a data test for the Home card's states.
- **Acceptance tests:**
  - `e2e/meeting.spec.ts`: the committee opens a poll with three slots; two residents of
    `e2e-1` share a vote; a resident of `e2e-2` votes; the ranking updates; the committee
    closes and confirms; the announcement and "Add to calendar" appear;
  - axe on the new routes.

**Demo flow:** the committee opens a poll → two apartments vote → the ranking updates → the
committee confirms → the announcement and the calendar link appear on Home.

## M7: Launch (`m7-launch`)

Requirements: R34–R40.

1. **Production services** (large, needs you).
   - A Vercel project; the Neon `main` branch, migrated and seeded with the demo building.
   - The `mail.ts` Resend driver, with `lobbie.co.il` DNS (SPF, DKIM).
   - The `storage.ts` Vercel Blob driver.
   - Env for each environment, and the domain's DNS.
   - `scripts/create-building.ts` (a name and the first admin's email).
   - The sign-in rate limit per IP takes the platform's trusted address (`ipAddress()` from
     `@vercel/functions`, or `x-real-ip`) instead of the first `x-forwarded-for` entry.
   - A test-only `RATE_LIMIT_PER_IP_MAX`, honoured only when `MAIL_TRANSPORT=outbox` and
     refused when `VERCEL_ENV` is set, replaces the e2e helper's random `x-forwarded-for`
     (which stops working once the per-IP limit uses the platform address).
   - Tests: driver unit tests with the SDKs mocked; the script on PGlite.
2. **Demo sign-in** (medium). `actions/demo.signInAsDemo(role)` creates a session for the
   seeded demo user (a Better Auth server session) only when the building is `isDemo`. A
   banner says "demo, read-only". Tests: every action family refuses writes in a demo
   building (a shared helper test); e2e "Try the demo" lands on Home.
3. **Welcome page and SEO** (medium).
   - `/welcome` (he and en); signed-out visitors to `/` are sent there.
   - Metadata for each page, Open Graph images, `sitemap.ts` and `robots.ts` (public pages
     only; app pages are `noindex`), icons and `manifest.ts`.
   - Tests: e2e checks the sitemap entries, `robots`, and `noindex` on an app page.
4. **Errors, headers and monitoring** (medium).
   - Localized `not-found.tsx`, `error.tsx` and `global-error.tsx`.
   - Security headers: CSP without nonces (as decided above), HSTS, `frame-ancestors 'none'`,
     Referrer-Policy and Permissions-Policy.
   - Vercel Analytics and Speed Insights, with web vitals sent to analytics.
   - Tests: e2e checks the headers on a public and an app route, the 404 in both languages,
     and no CSP console errors anywhere in the suite.
5. **States and accessibility sweep** (medium-large). On every route: loading, empty and
   error states, a keyboard walk, and axe in both languages and themes. Plus the admin
   polish from earlier "Should fix" items. Tests: `e2e/a11y.spec.ts` covers every route.
6. **README and production report** (medium). The README follows the kit. The observer
   runs against production. Tests: links in the README checked; the observer report is
   committed.
- **Acceptance tests:** `e2e/launch.spec.ts`: welcome → Try the demo → Home, and welcome →
  Sign in; plus the header, SEO and 404 tests above.

**Demo flow:** visit `lobbie.co.il` → the welcome page → "Try the demo" as the committee →
Home and Money in read-only mode → sign in with a real email.

---

## Time estimate

Calibration from the kit:
- a small task takes 4–6 min, a medium one 8–12, a large one 15–25;
- each milestone adds 20–35 min for the reviews, the fix wave, the gates and the demo;
- your review takes 10–15 min per PR.

The scaffold and repository are already done (about 10 minutes).

M1's estimate is padded, following the plan review. It combines a new technology mix (Better
Auth, Cache Components and next-intl) with three large tasks.

| Milestone | Tasks | Agent time (build + reviews + fixes + demo) | Your time | Notes |
|---|---|---|---|---|
| M1 Foundation and Home | 6 (3 large) | ~2 h 45 min (125 + 35 + 5 setup) | ~20 min (Neon setup + review) | New technology mix |
| M2 Building and people | 6 (1 large) | ~1 h 45 min (75 + 30) | ~15 min | |
| M3 Money | 6 (1 large, 1 medium-large) | ~2 h (88 + 32) | ~15 min | |
| M4 Life in the building | 6 | ~1 h 40 min (68 + 32) | ~15 min | |
| M5 Parking and cameras | 5 (1 large) | ~1 h 30 min (60 + 30) | ~15 min | SSRF-safe fetch |
| M6 Annual meeting | 5 (1 large) | ~1 h 20 min (50 + 30) | ~15 min | |
| M7 Launch | 6 (1 large) | ~2 h (85 + 35) | ~30 min (Vercel, DNS, Resend) | Depends on your accounts |
| **Total** | **40** | **~13 h** | **~2 h 05 min** | plus the wait between each PR and its merge |

**Range:** 10 h best, 13 h likely, 19 h worst (agent time).

**What pushes it to the worst case:**
- an incompatibility between Better Auth sessions, Cache Components and next-intl's proxy
  that needs a workaround (M1);
- the shared Drizzle typing across the two drivers (M1);
- fix waves that take three rounds;
- DNS or Resend domain verification delays (M7);
- latency budgets missed because of the Neon round trip from Israel, needing caching or
  merged queries.

After M1, the remaining estimates are re-scaled by M1's actual/estimated ratio, stated in
M1's PR.

## Time log

| Milestone | Estimated | Actual | Why it differed |
|---|---|---|---|
| M1 | 2 h 45 min | | |
| M2 | 1 h 45 min | | |
| M3 | 2 h | | |
| M4 | 1 h 40 min | | |
| M5 | 1 h 30 min | | |
| M6 | 1 h 20 min | | |
| M7 | 2 h | | |
