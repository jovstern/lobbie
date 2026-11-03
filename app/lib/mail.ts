import 'server-only'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTranslator } from 'next-intl'
import { logger } from '@/app/lib/logger'
import { palette } from '@/app/ui/tokens'
import { dirFor } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'
import en from '@/messages/en.json'
import he from '@/messages/he.json'

const catalogs = { he, en } satisfies Record<Locale, typeof he>
// Email clients ignore CSS variables, so the light palette is written inline.
const colors = palette.light

type MagicLinkEmail = { to: string; url: string; locale: Locale }
type Message = { to: string; subject: string; text: string; html: string; url: string }
type Options = { outboxDir?: string; now?: Date }

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char)
}

function composeMagicLinkEmail({ to, url, locale }: MagicLinkEmail): Message {
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: 'Email' })
  const text = [t('greeting'), '', t('intro'), url, '', t('expiry'), t('ignore')].join('\n')
  const html = `<!doctype html>
<html lang="${locale}" dir="${dirFor(locale)}">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: ${colors.text}">
<p>${escapeHtml(t('greeting'))}</p>
<p>${escapeHtml(t('intro'))}</p>
<p><a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 20px; border-radius: 10px; background: ${colors.accent}; color: ${colors['on-accent']}; text-decoration: none; font-weight: 600">${escapeHtml(t('action'))}</a></p>
<p>${escapeHtml(t('expiry'))}</p>
<p style="color: ${colors['text-muted']}">${escapeHtml(t('ignore'))}</p>
</body>
</html>
`
  return { to, subject: t('subject'), text, html, url }
}

// Local development and e2e only: each email becomes a JSON file that tests read by recipient.
async function writeToOutbox(message: Message, { outboxDir, now = new Date() }: Options) {
  if (process.env.VERCEL_ENV) {
    throw new Error(
      'The outbox mail transport is for local use; unset MAIL_TRANSPORT where VERCEL_ENV is set.',
    )
  }
  const dir = outboxDir ?? path.join(process.cwd(), '.data', 'outbox')
  // The recipient becomes part of a file name, so nothing in it may leave the directory.
  const recipient = message.to.replace(/[^A-Za-z0-9@._+-]/g, '_')
  const file = path.join(dir, `${now.getTime()}-${recipient}.json`)
  await mkdir(dir, { recursive: true })
  // Written aside, then renamed (atomic): a reader polling for `*.json` never sees half a file.
  await writeFile(`${file}.tmp`, JSON.stringify({ ...message, sentAt: now.toISOString() }, null, 2))
  await rename(`${file}.tmp`, file)
  // The link signs someone in and the address is personal: only the domain is logged.
  logger.info('magic link written to outbox', { toDomain: message.to.split('@').at(-1) })
}

/** Sends the sign-in link in the person's language through the transport `MAIL_TRANSPORT` names. */
export async function sendMagicLinkEmail(email: MagicLinkEmail, options: Options = {}) {
  const transport = process.env.MAIL_TRANSPORT
  if (transport !== 'outbox') {
    throw new Error(
      'mail not configured: set MAIL_TRANSPORT=outbox in .env.local (see .env.example).',
    )
  }
  await writeToOutbox(composeMagicLinkEmail(email), options)
}
