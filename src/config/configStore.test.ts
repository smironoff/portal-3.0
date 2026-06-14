import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV: Record<string, string> = {
  VITE_ENV: 'staging',
  VITE_API_URL: 'https://example.com/cportal',
  VITE_RATES_URL: 'https://example.com/cportal',
  VITE_AUTH_URL: 'https://auth.example.com',
  VITE_KEYCLOAK_URL: 'https://kc.example.com',
  VITE_KEYCLOAK_REALM: 'portal',
  VITE_KEYCLOAK_CLIENT_ID: 'portal-web',
  VITE_DEFAULT_LANGUAGE: 'en',
  VITE_PULL_APP_STATUS_SEC: '30',
  VITE_LOGOUT_AFTER_MIN: '15',
}

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('derives the TFBO data URL from API_URL', async () => {
    const { loadConfig } = await import('./configStore')
    const cfg = loadConfig()
    expect(cfg.API_DATA_URL).toBe('https://example.com/cportal/nsdata')
    expect(cfg.PAYMENT_URL).toBe('https://example.com/cportal/payment')
  })

  it('coerces numeric env strings to numbers', async () => {
    const { loadConfig } = await import('./configStore')
    expect(loadConfig().PULL_APP_STATUS_SEC).toBe(30)
  })

  it('throws when a required variable is missing or invalid', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { loadConfig } = await import('./configStore')
    expect(() => loadConfig()).toThrow()
  })
})
