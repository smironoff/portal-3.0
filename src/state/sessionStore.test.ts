import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessionStore'

describe('sessionStore', () => {
  beforeEach(() => useSessionStore.getState().reset())

  it('starts logged out', () => {
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })

  it('opens the session gate on setLoggedIn(true)', () => {
    useSessionStore.getState().setLoggedIn(true)
    expect(useSessionStore.getState().loggedIn).toBe(true)
  })

  it('reset closes the gate', () => {
    useSessionStore.getState().setLoggedIn(true)
    useSessionStore.getState().reset()
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })
})
