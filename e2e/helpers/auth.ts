/*
 * Magic links per seeded email in one run (both projects, desktop and phone), against the
 * per-email limit of 3 per 15 minutes. Keep every row at 2 or less, so there is a margin.
 * `useSessionOf` signs in once per email per run (the session file is shared by the projects).
 *
 * | Email                  | Where                                              | Links |
 * | ---------------------- | -------------------------------------------------- | ----- |
 * | e2e1@example.com       | sign-in.spec (resident lands on Home), ×2 projects |     2 |
 * | e2e2@example.com       | admin-people.spec, useSessionOf                    |     1 |
 * | e2e3@example.com       | directory.spec, useSessionOf                       |     1 |
 * | resident1@example.com  | useSessionOf (a11y, auth, home, directory, ...)    |     1 |
 * | resident9@example.com  | useSessionOf (a11y, home)                          |     1 |
 * | admin@example.com      | useSessionOf (admin-*, a11y, invite)               |     1 |
 * | committee1@example.com | useSessionOf (admin-*, a11y)                       |     1 |
 * | committee2@example.com | useSessionOf (directory)                           |     1 |
 *
 * Everyone else who signs in is created by the test for its project (and locale, where it
 * loops over them) and removed afterwards, so each such address signs in once: profile-*,
 * more-*, leaving-*, signout-*, demo-*, invitee-*, join-a11y-*.
 */
import { randomInt } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import { z } from 'zod'
import { messages, type Locale } from './copy'
import { latestLinkFor } from './outbox'

export const sessionsDir = path.join('.data', 'e2e-sessions')

export const localePrefix = (locale: Locale) => (locale === 'en' ? '/en' : '')

/**
 * Gives the page an address of its own. Every test reaches the server from localhost, so
 * without this the whole run would share one per-IP sign-in limit (10 per 15 minutes). The
 * limit itself is covered by the rate-limit unit tests.
 */
export async function asNewClient(page: Page) {
  const octet = () => randomInt(1, 255)
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${octet()}.${octet()}.${octet()}` })
}

type SignInOptions = {
  locale?: Locale
  /** Where the link should land; Home in `locale` by default. */
  landing?: string
}

/**
 * Signs in through the real flow: the form (opened unless the page is already on it), the
 * email in the outbox, then the link. Returns the link, which works only once.
 */
export async function signIn(page: Page, email: string, options: SignInOptions = {}) {
  const locale = options.locale ?? 'he'
  const prefix = localePrefix(locale)
  await asNewClient(page)
  const signInPath = `${prefix}/sign-in`
  if (!page.url().startsWith('http') || new URL(page.url()).pathname !== signInPath) {
    await page.goto(signInPath)
  }

  const since = new Date()
  const form = messages[locale].SignInForm
  await page.getByLabel(form.emailLabel).fill(email)
  await page.getByRole('button', { name: form.submit }).click()
  await expect(page).toHaveURL(`${prefix}/sign-in/check-email`)

  await expect
    .poll(() => latestLinkFor(email, since), { timeout: 10_000, message: `no link for ${email}` })
    .not.toBeNull()
  const link = await latestLinkFor(email, since)
  if (link === null) throw new Error(`no link for ${email}`)

  await page.goto(link)
  await expect(page).toHaveURL(options.landing ?? (prefix || '/'))
  await expect(page.getByRole('main')).toBeVisible()
  return link
}

const savedCookies = z.array(
  z.object({
    name: z.string(),
    value: z.string(),
    domain: z.string(),
    path: z.string(),
    expires: z.number(),
    httpOnly: z.boolean(),
    secure: z.boolean(),
    sameSite: z.enum(['Strict', 'Lax', 'None']),
  }),
)

/**
 * Gives the page a session for `email` without a new link each time: read-only tests share one
 * sign-in per person per run, which keeps them inside the per-email limit (3 per 15 minutes).
 * The page is left blank; the caller opens the page it needs. Never use it for a person whose
 * session a test ends.
 */
export async function useSessionOf(page: Page, email: string) {
  const file = path.join(sessionsDir, `${email}.json`)
  const saved = await readFile(file, 'utf8').then(
    (text) => savedCookies.parse(JSON.parse(text)),
    () => null,
  )
  if (saved) {
    await page.context().addCookies(saved)
    return
  }

  await signIn(page, email)
  // The language a test runs in is its own choice, not the one sign-in happened in.
  const cookies = (await page.context().cookies()).filter(({ name }) => name !== 'NEXT_LOCALE')
  await page.context().clearCookies({ name: 'NEXT_LOCALE' })
  await mkdir(sessionsDir, { recursive: true })
  await writeFile(file, JSON.stringify(cookies))
  await page.goto('about:blank')
}
