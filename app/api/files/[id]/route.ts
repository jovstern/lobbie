import { unstable_rethrow } from 'next/navigation'
import { receipt } from '@/app/lib/data/expenses'
import { logger } from '@/app/lib/logger'
import { get } from '@/app/lib/storage'

const route = '/api/files/[id]'

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

/**
 * A receipt, by its storage key (R19). A Route Handler because an `<a>` or `<img>` has to GET
 * it. Only a member of the building whose expense names the key gets the file; everyone else
 * (signed out, without a building, another building's member) and an unknown key get the same
 * 404, so nothing tells whether a receipt exists. The type is the one its bytes were checked
 * to be when stored; `nosniff` keeps the browser to it, a PDF downloads rather than opening in
 * the app's origin, and nothing is kept in a shared cache.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/files/[id]'>) {
  const { id: key } = await ctx.params
  try {
    const expense = await receipt(key)
    if (!expense) return notFound()
    const file = await get(key)
    if (!file) {
      // The row names a file the store does not have.
      logger.error('A receipt named by an expense is missing', { area: 'api/files', route, key })
      return notFound()
    }
    const isPdf = file.contentType === 'application/pdf'
    const name = `receipt-${expense.spentOn}.${key.split('.').at(-1)}`
    return new Response(file.bytes, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.bytes.length),
        'Content-Disposition': `${isPdf ? 'attachment' : 'inline'}; filename="${name}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        // Opened on its own, the file may run nothing and load nothing.
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to serve a receipt', { area: 'api/files', route, err })
    return new Response('Something went wrong', {
      status: 500,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  }
}
