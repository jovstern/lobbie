import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip'

describe('clientIp', () => {
  it('takes the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 10.0.0.1 , 10.0.0.2' }))).toBe('10.0.0.1')
  })

  it('is "unknown" without one', () => {
    expect(clientIp(new Headers())).toBe('unknown')
    expect(clientIp(new Headers({ 'x-forwarded-for': ' ' }))).toBe('unknown')
  })
})
