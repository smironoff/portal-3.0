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
    tokenStore.setAuthTokens({
      accessToken: 'a',
      refreshToken: 'r',
      idToken: 'i',
      refreshTokenValidUntil: '',
    })
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

  it('hasValidSession is true for a refresh token with a future validUntil', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2999-01-01T00:00:00Z' })
    expect(tokenStore.hasValidSession()).toBe(true)
  })
  it('hasValidSession is false when validUntil is in the past', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2000-01-01T00:00:00Z' })
    expect(tokenStore.hasValidSession()).toBe(false)
  })
  it('hasValidSession is false with no refresh token', () => {
    localStorage.setItem(STORAGE_KEYS.validUntil, '2999-01-01T00:00:00Z')
    expect(tokenStore.hasValidSession()).toBe(false)
  })
  it('hasValidSession is false for an empty or unparseable validUntil', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: 'not-a-date' })
    expect(tokenStore.hasValidSession()).toBe(false)
  })
})
