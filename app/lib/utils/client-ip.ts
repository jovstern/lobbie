/** The address a request came from, for per-IP rate limits: the first `x-forwarded-for` hop. */
export function clientIp(requestHeaders: Headers): string {
  return requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
