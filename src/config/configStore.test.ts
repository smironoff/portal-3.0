import { describe, it, expect, vi, beforeEach } from 'vitest'

const RAW = {
  ENV: 'staging',
  API_URL: 'https://example.com/cportal',
  RATES_URL: 'https://example.com/cportal',
  AUTH_URL: 'https://auth.example.com',
  KEYCLOAK_URL: 'https://kc.example.com',
  KEYCLOAK_REALM: 'portal',
  KEYCLOAK_CLIENT_ID: 'portal-web',
  DEFAULT_LANGUAGE: 'en',
  PULL_APP_STATUS_SEC: 30,
  LOGOUT_AFTER_MIN: 15,
}

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('derives the TFBO data URL from API_URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => RAW })))
    const { loadConfig } = await import('./configStore')
    const cfg = await loadConfig()
    expect(cfg.API_DATA_URL).toBe('https://example.com/cportal/nsdata')
    expect(cfg.PAYMENT_URL).toBe('https://example.com/cportal/payment')
  })

  it('throws a clear error when config fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const { loadConfig } = await import('./configStore')
    await expect(loadConfig()).rejects.toThrow(/configuration/i)
  })
})
