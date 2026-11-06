import type messages from '@/messages/he.json'

/** A message function for one namespace, as the Zod schemas of the Server Actions take it. */
export type Translate<Namespace extends keyof typeof messages> = (
  key: keyof (typeof messages)[Namespace],
) => string

/** What a form field held when it was sent, so an error never loses the person's typing. */
export function typed(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}
