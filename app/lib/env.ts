import { z } from 'zod'

const value = z.string().trim().min(1)

type EnvSource = Record<string, string | undefined>

/**
 * Reads a required environment variable. The error names the variable and never its value,
 * because connection strings and secrets must not reach logs.
 */
export function requireEnv(name: string, source: EnvSource = process.env): string {
  const parsed = value.safeParse(source[name])
  if (!parsed.success) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`)
  }
  return parsed.data
}
