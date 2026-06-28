import { describe, it, expect, beforeEach } from 'vitest'
import { savePkce, consumePkce } from './pkceStore'

describe('pkceStore', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips and clears on consume', () => {
    savePkce({ codeVerifier: 'v', state: 's', provider: 'apple' })
    expect(consumePkce()).toEqual({ codeVerifier: 'v', state: 's', provider: 'apple' })
    expect(consumePkce()).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(consumePkce()).toBeNull()
  })
})
