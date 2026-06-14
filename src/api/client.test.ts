import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getHttpClient', () => {
  beforeEach(() => vi.resetModules())

  it('builds a single client lazily from config and reuses it', async () => {
    vi.doMock('@/config/configStore', () => ({
      getConfig: () => ({ API_DATA_URL: 'https://api.test/nsdata', AUTH_URL: 'https://auth.test' }),
    }))
    const { getHttpClient } = await import('./client')
    const a = getHttpClient()
    const b = getHttpClient()
    expect(a).toBe(b)
    expect(typeof a.auth).toBe('function')
    expect(typeof a.tfbo).toBe('function')
  })
})
