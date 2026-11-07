import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { ReactNode } from 'react'

type Messages = Awaited<ReturnType<typeof getMessages>>
export type Namespace = keyof Messages

/**
 * The namespaces client components read on any page: the shell, the error page, the residents'
 * pages and the public ones. Each admin page adds its own with `ClientMessages`, so a page
 * ships only the copy its client components can show, not every admin form's.
 */
export const sharedNamespaces = [
  'CommitteeContactForm',
  'Common',
  'ContactVisibility',
  'ErrorPage',
  'JoinCodeForm',
  'LanguageChoice',
  'LanguageSwitch',
  'ProfileForm',
  'Search',
  'SignInForm',
] as const satisfies Namespace[]

/** `messages` with only these namespaces. */
export function pickMessages(messages: Messages, namespaces: readonly Namespace[]) {
  return Object.fromEntries(namespaces.map((namespace) => [namespace, messages[namespace]]))
}

type Props = {
  /** The namespaces this part of the app's client components read, beyond the shared ones. */
  namespaces: readonly Namespace[]
  children: ReactNode
}

/**
 * The client components' messages for one admin page: the shared ones and its own. A nested
 * provider replaces its parent's messages, so the shared ones come along.
 */
export default async function ClientMessages({ namespaces, children }: Props) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={pickMessages(messages, [...sharedNamespaces, ...namespaces])}>
      {children}
    </NextIntlClientProvider>
  )
}
