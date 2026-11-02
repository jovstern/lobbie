import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/app/lib/logger'

const now = new Date('2026-03-01T10:00:00.000Z')

function lastLine(spy: { mock: { calls: unknown[][] } }): unknown {
  const call = spy.mock.calls.at(-1)
  expect(call).toBeDefined()
  return JSON.parse(String(call?.[0]))
}

describe('logger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(['info', 'warn', 'error'] as const)(
    'writes one JSON line for %s with level, msg, time and context',
    (level) => {
      const spy = vi.spyOn(console, level).mockImplementation(() => {})

      logger[level]('payments loaded', { route: '/money', durationMs: 42 })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(lastLine(spy)).toEqual({
        level,
        msg: 'payments loaded',
        time: now.toISOString(),
        route: '/money',
        durationMs: 42,
      })
    },
  )

  it('writes a line without context', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('started')

    expect(lastLine(spy)).toEqual({ level: 'info', msg: 'started', time: now.toISOString() })
  })

  it('serialises an Error as name, message and stack', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new TypeError('boom')

    logger.error('query failed', { route: '/', err: error })

    expect(lastLine(spy)).toEqual({
      level: 'error',
      msg: 'query failed',
      time: now.toISOString(),
      route: '/',
      err: { name: 'TypeError', message: 'boom', stack: error.stack },
    })
  })

  it.each([
    ['a string', 'plain failure', 'plain failure'],
    ['an object', { code: 'E1' }, '{"code":"E1"}'],
    ['a number', 7, '7'],
  ])('serialises %s thrown as an error', (_, thrown, message) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.error('query failed', { err: thrown })

    expect(lastLine(spy)).toMatchObject({ err: { name: 'NonError', message } })
  })

  it('serialises the cause chain, at most three errors deep', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = new Error('socket closed')
    const middle = new Error('query failed', { cause: root })
    const top = new Error('load failed', { cause: middle })
    const outer = new Error('page failed', { cause: top })

    logger.error('request failed', { err: outer })

    const line = lastLine(spy)
    expect(line).toMatchObject({
      err: {
        message: 'page failed',
        cause: { message: 'load failed', cause: { message: 'query failed' } },
      },
    })
    expect(line).not.toHaveProperty('err.cause.cause.cause')
  })

  it('serialises a non-Error cause', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.error('request failed', { err: new Error('failed', { cause: 'timeout' }) })

    expect(lastLine(spy)).toMatchObject({
      err: { message: 'failed', cause: { name: 'NonError', message: 'timeout' } },
    })
  })

  it.each([
    [
      'circular',
      () => {
        const circular: Record<string, unknown> = {}
        circular.self = circular
        return circular
      },
    ],
    ['BigInt', () => BigInt(10)],
  ])('falls back to a safe line when the context is %s', (_, makeValue) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('boom')

    expect(() =>
      logger.error('query failed', { route: '/', payload: makeValue(), err: error }),
    ).not.toThrow()

    expect(lastLine(spy)).toEqual({
      level: 'error',
      msg: 'query failed',
      time: now.toISOString(),
      err: { name: 'Error', message: 'boom', stack: error.stack },
      context: 'unserialisable',
    })
  })

  it('serialises a BigInt thrown as an error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.error('query failed', { err: BigInt(10) })

    expect(lastLine(spy)).toMatchObject({ err: { name: 'NonError', message: '10' } })
  })

  it('writes debug lines outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('cache miss', { key: 'home' })

    expect(lastLine(spy)).toMatchObject({ level: 'debug', msg: 'cache miss', key: 'home' })
  })

  it('suppresses debug lines in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('cache miss')

    expect(spy).not.toHaveBeenCalled()
  })
})
