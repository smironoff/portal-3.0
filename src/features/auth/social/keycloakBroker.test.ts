import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthUrl,
  decodeIdTokenClaims,
} from './keycloakBroker'

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('keycloakBroker', () => {
  it('derives the S256 challenge per the RFC 7636 test vector', async () => {
    const challenge = await deriveCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generateCodeVerifier returns a 43-char base64url string', () => {
    const v = generateCodeVerifier()
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('buildAuthUrl includes client, S256, scope, state and the provider hint', () => {
    const url = new URL(
      buildAuthUrl({ provider: 'google', redirectUri: 'https://app.test/account/callback', state: 'st8', codeChallenge: 'chal' })
    )
    expect(url.origin + url.pathname).toBe('https://kc.test/realms/thinkmarkets/protocol/openid-connect/auth')
    expect(url.searchParams.get('client_id')).toBe('web-app')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('code_challenge')).toBe('chal')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('st8')
    expect(url.searchParams.get('kc_idp_hint')).toBe('google')
  })

  it('decodeIdTokenClaims reads name and email', () => {
    const token = `h.${b64url({ email: 'a@b.com', given_name: 'Ada', family_name: 'Lovelace' })}.s`
    expect(decodeIdTokenClaims(token)).toEqual({ email: 'a@b.com', firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('decodeIdTokenClaims falls back to preferred_username and reports missing names', () => {
    const token = `h.${b64url({ preferred_username: 'relay@privaterelay.appleid.com' })}.s`
    expect(decodeIdTokenClaims(token)).toEqual({
      email: 'relay@privaterelay.appleid.com',
      firstName: undefined,
      lastName: undefined,
    })
  })
})
