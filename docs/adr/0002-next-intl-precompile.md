# ADR 0002 — Precompile next-intl messages at build time

- Status: accepted
- Date: 2026-11-06
- Decided by: the user, in the M2 performance fix round

## Context

The first-load JS budget is ≤ 165 kB per route, of which ≤ 30 kB is Lobbie's own code
(spec §8). After the M2 dialogs were lazy-loaded, the admin pages were still at 167–172 kB.
The app shell alone was 160.8 kB on every route, and 12.1 kB of it was next-intl's runtime ICU
parser and formatter (`intl-messageformat`), shipped because client components call
`useTranslations`.

## Options

1. Keep the runtime parser and accept the miss on the admin pages.
2. Pass translated strings from Server Components as props, so no client component formats a
   message. This means rewriting every client component, and plurals and rich text would be
   formatted on the server only.
3. next-intl's `experimental.messages.precompile`: the plugin compiles the ICU messages to a
   compact form at build time, and the client formats them with a small formatter.

## Decision

Option 3, in `next.config.ts` (`experimental.messages` with `path: './messages'`,
`format: 'json'`, `locales: 'infer'`, `precompile: true`). Components do not change.

## Consequences

- The flag is experimental, so a next-intl upgrade may change or drop it. If it breaks,
  revert by removing the `experimental` option. Nothing else depends on it.
- `t.raw` does not work with precompiled messages. Lobbie does not use it, and must not.
- Plurals, selects and `t.rich` tags (e.g. the apartment heading's `<number>`) go through the
  compiled form; no message uses `<bdi>` or `t.markup` today. The unit
  tests format the raw JSON and the e2e suite checks the rendered copy, so a formatting
  regression fails the gates.
