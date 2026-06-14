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
    expect(localStorage.getItem(STORAGE_KEYS.idToken)).toBe('i')
    expect(tokenStore.getAccessToken()).toBe('a')
  })

  it('clears all tokens', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' })
    tokenStore.clear()
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull()
    expect(tokenStore.getAccessToken()).toBe('')
  })

  it('removes stale idToken when setAuthTokens is called without one', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', idToken: 'i', refreshTokenValidUntil: '' })
    tokenStore.setAuthTokens({ accessToken: 'a2', refreshToken: 'r2', refreshTokenValidUntil: '' })
    expect(localStorage.getItem(STORAGE_KEYS.idToken)).toBeNull()
  })

  it('persists TFBO session and token under the legacy keys', () => {
    tokenStore.setTfbo('sess123', 'tok456')
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('sess123')
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('tok456')
    expect(tokenStore.getTfboSession()).toBe('sess123')
    expect(tokenStore.getTfboToken()).toBe('tok456')
  })
})
