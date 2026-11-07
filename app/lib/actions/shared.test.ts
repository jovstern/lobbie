import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  refreshApartmentPages,
  refreshExpensePages,
  refreshFeePages,
  refreshFundPages,
  refreshPaymentPages,
  refreshPeoplePages,
} from '@/app/lib/actions/shared'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }))

beforeEach(() => vi.mocked(revalidatePath).mockClear())

const helpers = {
  refreshApartmentPages,
  refreshPeoplePages,
  refreshFeePages,
  refreshFundPages,
  refreshPaymentPages,
  refreshExpensePages,
}

describe('refresh helpers', () => {
  // A page pattern matches only when it is the page file's path, route groups included
  // (Next tags each page `<path>/page` from its file under app/); one that names no page file
  // refreshes nothing, silently.
  it.each(Object.entries(helpers))('%s names only real page files', (_name, refresh) => {
    refresh()
    const calls = vi.mocked(revalidatePath).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [path, type] of calls) {
      expect(type).toBe('page')
      expect(existsSync(join(process.cwd(), 'app', path, 'page.tsx')), path).toBe(true)
    }
  })

  it('refreshes Home and both Money pages where their route groups put them', () => {
    refreshFeePages()
    refreshFundPages()
    const paths = vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/[locale]/(app)/(home)',
        '/[locale]/(app)/money/(overview)',
        '/[locale]/(app)/money/balance',
      ]),
    )
  })
})
