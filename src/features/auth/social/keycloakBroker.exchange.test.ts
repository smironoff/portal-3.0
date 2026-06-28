import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import { exchangeCodeForTokens } from './keycloakBroker'

describe('exchangeCodeForTokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('posts the PKCE form and maps the Keycloak response to AuthTokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'AT',
        refresh_token: 'RT',
        id_token: 'IT',
        refresh_expires_in: 3600,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeCodeForTokens('the-code', 'the-verifier', 'https://app.test/account/callback')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://kc.test/realms/thinkmarkets/protocol/openid-connect/token')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
    expect(body.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(body.get('client_id')).toBe('web-app')
    expect(tokens).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      idToken: 'IT',
      refreshTokenValidUntil: '2026-01-01T01:00:00.000Z',
    })
  })

  it('throws when the exchange is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }))
    await expect(exchangeCodeForTokens('c', 'v', 'r')).rejects.toThrow('Token exchange failed (HTTP 400)')
  })
})
