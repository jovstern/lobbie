import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

export const outboxDir = path.join('.data', 'outbox')

const outboxMessage = z.object({
  to: z.string(),
  url: z.url(),
  sentAt: z.iso.datetime(),
})

/** The sign-in link most recently sent to `email` at or after `since`, or null. */
export async function latestLinkFor(email: string, since: Date): Promise<string | null> {
  let names: string[]
  try {
    names = await readdir(outboxDir)
  } catch {
    return null
  }
  const messages = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map(async (name) =>
        outboxMessage.parse(JSON.parse(await readFile(path.join(outboxDir, name), 'utf8'))),
      ),
  )
  const [latest] = messages
    .filter((message) => message.to === email && new Date(message.sentAt) >= since)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  return latest?.url ?? null
}
