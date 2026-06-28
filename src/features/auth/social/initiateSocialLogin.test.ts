import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import { initiateSocialLogin } from './initiateSocialLogin'
import { consumePkce } from './pkceStore'

describe('initiateSocialLogin', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('persists the PKCE session and redirects to the Keycloak auth URL', async () => {
    const assign = vi.fn()
    // jsdom location.assign is not implemented; replace it
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test', assign },
      writable: true,
    })

    await initiateSocialLogin('google')

    expect(assign).toHaveBeenCalledTimes(1)
    const url = new URL(assign.mock.calls[0][0] as string)
    expect(url.searchParams.get('kc_idp_hint')).toBe('google')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')

    const saved = consumePkce()
    expect(saved?.provider).toBe('google')
    expect(saved?.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('state')).toBe(saved?.state)
  })
})
