# ADR 0001 — Architecture: Next.js full stack on Postgres (Neon) with Better Auth

- Status: accepted
- Date: 2026-11-02
- Decided by: the user, in `/build` discovery

## Context

Lobbie is a responsive web app for a building's residents and committee (brief:
`docs/brief.md`). The data is relational: buildings → apartments → memberships, fee rates,
payments; expenses; schedules with exceptions; meeting votes per apartment and slot. Money
must be exact (integer agorot) and auditable, and several writes touch more than one row,
so the store needs transactions and constraints. Hebrew (RTL) is the default language,
English the second. Sign-in is an email magic link. Hosting is local-only until the launch
milestone, then Vercel on `lobbie.co.il`.

Versions checked on 2026-11-02 with `npm view`: next 16.4.3, react 19.3, drizzle-orm
0.45.4, drizzle-kit 0.31.11, postgres 3.4.9, @electric-sql/pglite 0.5.13, next-intl 4.14.9,
zod 4.6.7, tailwindcss 4.3.3, better-auth 1.7.14, next-auth latest 4.24.15 / beta
5.0.0-beta.32.

## Options

|      | A. Next.js + Postgres (Neon)                          | B. Next.js + SQLite, Postgres at launch                                     | C. Next.js + MongoDB                                           |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Data | Drizzle on Neon Postgres; one dialect dev → prod      | `better-sqlite3` locally, ported at launch                                  | local Mongo, Atlas at launch                                   |
| Fit  | Relational data, transactions, `CHECK`/FK constraints | Zero accounts until launch                                                  | Mongo already installed                                        |
| Cost | A free Neon project now                               | A dialect migration right before launch (Vercel cannot host an SQLite file) | No FKs; transactions need a replica set; poor fit for a ledger |

Auth: Auth.js has magic link only in v5, still beta (`5.0.0-beta.32`); Better Auth 1.7 is a
stable release with an official magic-link plugin and Drizzle adapter.

## Decision

**Option A with Better Auth.**

- **Next.js 16 App Router**, TypeScript strict, React Compiler, Cache Components (the
  starter's config). Server Components read through `app/lib/data.ts`; Server Actions write
  through `app/lib/actions/*.ts`.
- **Postgres on Neon**, created through Vercel's Neon integration (branches `dev` and `test` now, `main` for production at launch),
  **Drizzle ORM** on the `postgres` driver (TCP; supports interactive transactions), schema
  and SQL migrations in the repo (`drizzle-kit`).
- **Tests:** unit and data-layer tests on **PGlite** (in-process Postgres, a fresh database
  per test file, migrations applied); e2e against the Neon `test` branch, reset and seeded
  before each run. Tests never touch the `dev` branch.
- **Better Auth** with the magic-link plugin and Drizzle adapter; its handler is the one
  Route Handler for auth (`/api/auth/[...all]`), because the link in the email calls it.
- **next-intl** with `localePrefix: 'as-needed'`: Hebrew unprefixed (`/`), English under
  `/en`. `dir` set from the locale; Tailwind logical utilities only.
- **Tailwind v4** with tokens in `@theme`; light and dark themes from
  `prefers-color-scheme`. **Radix** primitives. Rubik (Hebrew + Latin) through `next/font`.
- **Local stand-ins behind interfaces until launch:** mail → a file outbox (Resend at launch);
  file storage → local disk under `.data/` (Vercel Blob at launch).
- **Hosting at launch:** Vercel, Neon `main`, Resend sending from `lobbie.co.il`, Vercel
  Analytics + Speed Insights + runtime logs.

## Consequences

- The user creates the Neon project through Vercel's Neon Postgres integration (Storage →
  Neon), adds `dev` and `test` branches in the Neon console before M1's data task, and keeps
  both connection strings in `.env.local`. At launch the same database is connected to the
  Vercel project; its `main` branch is production.
- Departing from the kit's default (Auth.js) is deliberate: a stable release over a beta.
  The pattern for reading the session in Server Components is
  `auth.api.getSession({ headers: await headers() })`, wrapped once in `app/lib/session.ts`.
- With Cache Components, every session-dependent read sits inside `<Suspense>`; the static
  shell (layout, navigation frame) renders instantly.
- CI needs no database: format, lint, types and the unit/data tests (PGlite) run on GitHub
  (the user approved adding `npm test`); build and e2e run locally before each PR and are
  reported in it.
- Better Auth is configured to generate uuid ids, so every `userId` FK is a `uuid`.
- The CSP ships without nonces: nonces force dynamic rendering and disable the static shell
  and partial prefetching (installed `content-security-policy.md`).
- Moving to production is configuration (env and drivers behind `mail.ts` and `storage.ts`),
  not a rewrite.
