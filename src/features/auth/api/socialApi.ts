import { getConfig } from '@/config/configStore'
import type { AuthResult, ProfileStatus, SocialRegisterParams } from './authTypes'

// The auth-adapter validates the Keycloak id_token as a bearer credential. We
// use the id_token (not the access token) because Apple access tokens issued
// through Keycloak can lack sub/email. These are direct fetches, not the shared
// httpClient.auth() which sends the access token.
export const checkProfileStatus = async (idToken: string): Promise<ProfileStatus> => {
  const res = await fetch(`${getConfig().AUTH_URL}/auth/profile/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Profile status failed (HTTP ${res.status})`)
  return (await res.json()) as ProfileStatus
}

export const socialRegister = async (
  idToken: string,
  params: SocialRegisterParams
): Promise<AuthResult> => {
  const res = await fetch(`${getConfig().AUTH_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  return (await res.json()) as AuthResult
}
