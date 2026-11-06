/** Someone as the app names them: the name they gave, or the address they sign in with. */
export type Named = { name: string | null; email: string }

/**
 * The name to show and to read out for a person. Someone who joined before saying their name
 * (or saved only spaces) is shown by their email, so no row, dialog or announcement is nameless.
 */
export function displayName({ name, email }: Named): string {
  return name?.trim() || email
}

/** Whether they gave a name; otherwise `displayName` is their email. */
export function hasGivenName({ name }: Pick<Named, 'name'>): boolean {
  return Boolean(name?.trim())
}
