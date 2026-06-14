import { describe, it, expect, beforeEach } from 'vitest'
import { tokenStore, STORAGE_KEYS } from './tokenStore'

describe('tokenStore', () => {
  beforeEach(() => localStorage.clear())

  it('persists auth tokens under the legacy keys', () => {
    tokenStore.setAuthTokens({
      accessToken: 'a',
      refreshToken: 'r',
      idToken: 'i',
      refreshTokenValidUntil: '2030-01-01T00:00:00Z',
    })
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBe('a')
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBe('r')
    expect(tokenStore.getAccessToken()).toBe('a')
  })

  it('clears all tokens', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' })
    tokenStore.clear()
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull()
    expect(tokenStore.getAccessToken()).toBe('')
  })
})
