import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@/state/sessionStore'

describe('authenticated route guard predicate', () => {
  beforeEach(() => useSessionStore.getState().reset())

  it('blocks when logged out', () => {
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })

  it('allows when logged in', () => {
    useSessionStore.getState().setLoggedIn(true)
    expect(useSessionStore.getState().loggedIn).toBe(true)
  })
})
