import { describe, expect, it } from 'vitest'
import { greet } from './actions'

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe('greet', () => {
  it('greets by name', async () => {
    expect(await greet({}, form({ name: ' Ada ' }))).toEqual({ message: 'Hello, Ada!' })
  })

  it('returns a field error when the name is empty', async () => {
    const state = await greet({}, form({ name: '' }))
    expect(state.errors?.name).toEqual(['Enter your name'])
  })
})
