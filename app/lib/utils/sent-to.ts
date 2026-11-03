/**
 * The flash cookie that tells check-email where the link went: set by the sign-in action,
 * read on the server, never in a URL (so it stays out of history and logs, and a crafted
 * link cannot make the page claim an address).
 */
export const sentToCookie = {
  name: 'lobbie_sent_to',
  options: {
    httpOnly: true,
    sameSite: 'lax',
    // Plain http is local development; production is https.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  },
} as const
