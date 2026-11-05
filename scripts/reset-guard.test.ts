import { describe, expect, it } from 'vitest'
import { checkResetTarget } from './reset-guard'

const dev = 'postgresql://u:p@ep-dev-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const test = 'postgresql://u:p@ep-test-456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'

describe('checkResetTarget', () => {
  it('allows a test database on another host', () => {
    expect(checkResetTarget({ DATABASE_URL: dev, E2E_DATABASE_URL: test })).toEqual({
      ok: true,
      url: test,
    })
  })

  it('allows a test database when DATABASE_URL is not set', () => {
    expect(checkResetTarget({ E2E_DATABASE_URL: test })).toEqual({ ok: true, url: test })
  })

  it.each([
    ['missing', {}],
    ['empty', { E2E_DATABASE_URL: ' ' }],
  ])('refuses when E2E_DATABASE_URL is %s', (_case, env) => {
    expect(checkResetTarget({ DATABASE_URL: dev, ...env })).toEqual({
      ok: false,
      reason: 'E2E_DATABASE_URL is not set. Add it to .env.local (see .env.example).',
    })
  })

  it('refuses when E2E_DATABASE_URL equals DATABASE_URL', () => {
    expect(checkResetTarget({ DATABASE_URL: dev, E2E_DATABASE_URL: dev })).toEqual({
      ok: false,
      reason: 'E2E_DATABASE_URL is the same as DATABASE_URL; refusing to reset the app database.',
    })
  })

  it('refuses when both point at the same host with another database name', () => {
    const sameHost = dev.replace('/neondb', '/other')
    expect(checkResetTarget({ DATABASE_URL: dev, E2E_DATABASE_URL: sameHost })).toEqual({
      ok: false,
      reason: 'E2E_DATABASE_URL has the same host as DATABASE_URL; refusing to reset it.',
    })
  })

  it.each([
    ['pooled app, direct test', dev, dev.replace('-pooler', '')],
    ['direct app, pooled test', dev.replace('-pooler', ''), dev.replace('/neondb', '/x')],
  ])('refuses the pooled and direct hosts of one branch: %s', (_case, appUrl, testUrl) => {
    expect(checkResetTarget({ DATABASE_URL: appUrl, E2E_DATABASE_URL: testUrl })).toEqual({
      ok: false,
      reason: 'E2E_DATABASE_URL has the same host as DATABASE_URL; refusing to reset it.',
    })
  })

  it('compares hosts case-insensitively', () => {
    const shouted = dev.replace('ep-dev-123', 'EP-DEV-123').replace('/neondb', '/x')
    expect(checkResetTarget({ DATABASE_URL: dev, E2E_DATABASE_URL: shouted })).toMatchObject({
      ok: false,
    })
  })

  it('refuses an E2E_DATABASE_URL that is not a URL, without echoing it', () => {
    const result = checkResetTarget({ DATABASE_URL: dev, E2E_DATABASE_URL: 'not a url secret' })
    expect(result).toEqual({ ok: false, reason: 'E2E_DATABASE_URL is not a valid URL.' })
  })
})
