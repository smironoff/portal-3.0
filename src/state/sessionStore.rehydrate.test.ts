import { describe, it, expect, beforeEach, vi } from 'vitest'
import { STORAGE_KEYS } from '@/api/tokenStore'

describe('sessionStore rehydration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('rehydrates loggedIn=true from a valid persisted session', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'r')
    localStorage.setItem(STORAGE_KEYS.validUntil, '2999-01-01T00:00:00Z')
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(true)
  })

  it('starts logged out when there is no valid session', async () => {
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })

  it('starts logged out when validUntil is in the past', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'r')
    localStorage.setItem(STORAGE_KEYS.validUntil, '2000-01-01T00:00:00Z')
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })
})
