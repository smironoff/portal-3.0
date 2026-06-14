import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAuthClient } from './authClient'
import { tokenStore } from './tokenStore'
import type { AppConfig } from '@/config/schema'

const cfg = { AUTH_URL: 'https://auth.test' } as AppConfig

describe('authClient.refreshOnce', () => {
  beforeEach(() => {
    localStorage.clear()
    tokenStore.setAuthTokens({ accessToken: 'old', refreshToken: 'r', refreshTokenValidUntil: '' })
  })

  it('refreshes once even when called concurrently (single-flight)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        tokens: { accessToken: 'new', refreshToken: 'r2', refreshTokenValidUntil: '2030' },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const auth = createAuthClient(cfg)

    const [a, b] = await Promise.all([auth.refreshOnce(), auth.refreshOnce()])

    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1) // single-flight
    expect(tokenStore.getAccessToken()).toBe('new')
  })

  it('returns false and fires TokenExpired path when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ERR' }) })))
    const auth = createAuthClient(cfg)
    const ok = await auth.refreshOnce()
    expect(ok).toBe(false)
  })

  it('returns false when no refresh token is present', async () => {
    tokenStore.clear()
    const auth = createAuthClient(cfg)
    expect(await auth.refreshOnce()).toBe(false)
  })

  it('does not attempt refresh when the refresh token is already expired', async () => {
    tokenStore.setAuthTokens({ accessToken: 'old', refreshToken: 'r', refreshTokenValidUntil: '2000-01-01T00:00:00.000Z' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const auth = createAuthClient(cfg)
    expect(await auth.refreshOnce()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
