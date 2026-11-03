import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/app/lib/logger'
import { sendMagicLinkEmail } from '@/app/lib/mail'

vi.mock('@/app/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const url = 'http://localhost:3100/api/auth/magic-link/verify?token=abc&callbackURL=%2F'
const now = new Date('2026-11-02T10:05:00.123Z')
let outboxDir: string

beforeEach(async () => {
  outboxDir = await mkdtemp(path.join(tmpdir(), 'lobbie-outbox-'))
  vi.stubEnv('VERCEL_ENV', undefined)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  await rm(outboxDir, { recursive: true, force: true })
})

async function outboxFiles() {
  const names = await readdir(outboxDir)
  return Promise.all(
    names.map(async (name) => ({
      name,
      content: JSON.parse(await readFile(path.join(outboxDir, name), 'utf8')),
    })),
  )
}

describe('sendMagicLinkEmail', () => {
  it.each([undefined, '', 'smtp'])('refuses to send when MAIL_TRANSPORT is %j', async (value) => {
    vi.stubEnv('MAIL_TRANSPORT', value)

    await expect(
      sendMagicLinkEmail({ to: 'a@example.com', url, locale: 'en' }, { outboxDir }),
    ).rejects.toThrow(/mail not configured.*MAIL_TRANSPORT/)
    expect(await readdir(outboxDir)).toEqual([])
  })

  it('refuses the outbox on Vercel', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'outbox')
    vi.stubEnv('VERCEL_ENV', 'preview')

    await expect(
      sendMagicLinkEmail({ to: 'a@example.com', url, locale: 'en' }, { outboxDir }),
    ).rejects.toThrow(/outbox.*VERCEL_ENV/)
    expect(await readdir(outboxDir)).toEqual([])
  })

  it('writes the English email to the outbox, named by time and recipient', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'outbox')

    await sendMagicLinkEmail({ to: 'e2e1@example.com', url, locale: 'en' }, { outboxDir, now })

    const [file, ...others] = await outboxFiles()
    expect(others).toEqual([])
    expect(file.name).toBe(`${now.getTime()}-e2e1@example.com.json`)
    expect(file.content).toEqual({
      to: 'e2e1@example.com',
      subject: 'Your Lobbie sign-in link',
      text: expect.stringContaining(url),
      html: expect.stringContaining(
        'href="http://localhost:3100/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
      ),
      url,
      sentAt: now.toISOString(),
    })
    expect(file.content.text).toContain('expires in 15 minutes')
    expect(file.content.html).toContain('<html lang="en" dir="ltr">')
  })

  it('writes Hebrew, right to left, for a Hebrew speaker', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'outbox')

    await sendMagicLinkEmail({ to: 'a@example.com', url, locale: 'he' }, { outboxDir, now })

    const [file] = await outboxFiles()
    expect(file.content.subject).toBe('קישור הכניסה שלכם ללובי')
    expect(file.content.text).toContain('15 דקות')
    expect(file.content.html).toContain('<html lang="he" dir="rtl">')
    expect(file.content.html).toContain('כניסה ללובי')
  })

  it("logs the recipient's domain, never the address or the link", async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'outbox')

    await sendMagicLinkEmail({ to: 'a@example.com', url, locale: 'en' }, { outboxDir, now })

    expect(logger.info).toHaveBeenCalledWith('magic link written to outbox', {
      toDomain: 'example.com',
    })
    const logged = JSON.stringify(vi.mocked(logger.info).mock.calls)
    expect(logged).not.toContain('a@example.com')
    expect(logged).not.toContain('token')
  })

  it('keeps an odd recipient inside the outbox directory', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'outbox')

    await sendMagicLinkEmail({ to: '../../x/y@example.com', url, locale: 'en' }, { outboxDir, now })

    const [file] = await outboxFiles()
    expect(file.name).toBe(`${now.getTime()}-.._.._x_y@example.com.json`)
  })
})
