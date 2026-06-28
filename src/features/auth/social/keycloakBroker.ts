import { getConfig } from '@/config/configStore'

export type SocialProvider = 'google' | 'apple'

const base64UrlEncode = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes.buffer)
}

export const deriveCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

export const buildAuthUrl = (params: {
  provider: SocialProvider
  redirectUri: string
  state: string
  codeChallenge: string
}): string => {
  const cfg = getConfig()
  const query = new URLSearchParams({
    client_id: cfg.KEYCLOAK_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    state: params.state,
    kc_idp_hint: params.provider,
  })
  return `${cfg.KEYCLOAK_URL}/realms/${cfg.KEYCLOAK_REALM}/protocol/openid-connect/auth?${query.toString()}`
}

export interface SocialClaims {
  email: string
  firstName?: string
  lastName?: string
}

// Apple may place the email in preferred_username (private relay) and omits the
// name after the first authorisation, so both are optional and fall back.
export const decodeIdTokenClaims = (idToken: string): SocialClaims => {
  const segment = idToken.split('.')[1] ?? ''
  const json = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
  return {
    email: (json.email as string) || (json.preferred_username as string) || '',
    firstName: (json.given_name as string) || undefined,
    lastName: (json.family_name as string) || undefined,
  }
}
