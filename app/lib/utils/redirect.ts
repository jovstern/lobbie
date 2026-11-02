// C0 controls and DEL: browsers strip some of them, which can turn "/\t/evil" into "//evil".
const controlCharacter = /[\u0000-\u001f\u007f]/

function isSafeRelativePath(path: string): boolean {
  return (
    path.startsWith('/') && path[1] !== '/' && !path.includes('\\') && !controlCharacter.test(path)
  )
}

function decodeOnce(path: string): string | null {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

/**
 * Returns `input` when it is a path on this site (a single leading `/`), otherwise
 * `fallback`. Used for `?next=` and auth callback URLs so a link can never send someone
 * to another origin. The path is returned as given, so its locale prefix is kept.
 */
export function safeNextPath(input: unknown, fallback = '/'): string {
  if (typeof input !== 'string') return fallback
  const decoded = decodeOnce(input)
  if (decoded === null) return fallback
  return isSafeRelativePath(input) && isSafeRelativePath(decoded) ? input : fallback
}
