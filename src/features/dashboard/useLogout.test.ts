import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const navigate = vi.fn()
const clear = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { clear } }))

beforeEach(() => {
  navigate.mockReset()
  clear.mockReset()
})

describe('useLogout', () => {
  it('clears tokens, resets the session, and navigates to login', async () => {
    const { useLogout } = await import('./useLogout')
    const { useSessionStore } = await import('@/state/sessionStore')
    useSessionStore.getState().setLoggedIn(true)
    const { result } = renderHook(() => useLogout())
    result.current()
    expect(clear).toHaveBeenCalled()
    expect(useSessionStore.getState().loggedIn).toBe(false)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/login', search: { error: undefined } })
  })

  it('still resets and navigates when clearing tokens throws', async () => {
    clear.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { useLogout } = await import('./useLogout')
    const { useSessionStore } = await import('@/state/sessionStore')
    useSessionStore.getState().setLoggedIn(true)
    const { result } = renderHook(() => useLogout())
    result.current()
    expect(useSessionStore.getState().loggedIn).toBe(false)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/login', search: { error: undefined } })
  })
})
