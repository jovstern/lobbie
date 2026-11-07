import { describe, expect, it } from 'vitest'
import { createDbClient } from './db-client'

describe('createDbClient', () => {
  // postgres-js connects lazily: nothing here opens a connection.
  it('closes idle connections before Neon drops them, and renews every connection', async () => {
    const { db, close } = createDbClient('postgres://user:pass@localhost:1/none')
    try {
      expect(db.$client.options).toMatchObject({
        prepare: false,
        idle_timeout: 20,
        max_lifetime: 30 * 60,
      })
    } finally {
      await close()
    }
  })
})
