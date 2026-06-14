import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHttpClient } from './httpClient'
import { createAuthClient } from './authClient'
import { tokenStore } from './tokenStore'
import type { AppConfig } from '@/config/schema'

const cfg = { API_DATA_URL: 'https://api.test/nsdata', AUTH_URL: 'https://auth.test' } as AppConfig

function payload(status: string, result = {}) {
  return {
    ok: true,
    json: async () => ({
      id: 1,
      session_id: 's',
      token: 't',
      payload: [{ module: 'm', action: 'a', status, result }],
    }),
  }
}

describe('httpClient.tfbo', () => {
  beforeEach(() => {
    localStorage.clear()
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' })
  })

  it('retries once after a successful refresh on NOT_AUTHORIZED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(payload('NOT_AUTHORIZED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          tokens: { accessToken: 'a2', refreshToken: 'r2', refreshTokenValidUntil: '' },
        }),
      })
      .mockResolvedValueOnce(payload('OK', { value: 42 }))
    vi.stubGlobal('fetch', fetchMock)

    const auth = createAuthClient(cfg)
    const http = createHttpClient(cfg, auth)
    const res = await http.tfbo<{ value: number }>({ payload: [{ module: 'm', action: 'a' }] })

    expect(res.payload[0]?.status).toBe('OK')
    expect(res.payload[0]?.result.value).toBe(42)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('fires TokenExpired when refresh fails', async () => {
    const expired = vi.fn()
    window.addEventListener('TokenExpired', expired)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(payload('NOT_AUTHORIZED'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ERR' }) })
    )
    const auth = createAuthClient(cfg)
    const http = createHttpClient(cfg, auth)
    await expect(http.tfbo({ payload: [{ module: 'm', action: 'a' }] })).rejects.toThrow(
      /session expired/i
    )
    expect(expired).toHaveBeenCalled()
    window.removeEventListener('TokenExpired', expired)
  })
})
