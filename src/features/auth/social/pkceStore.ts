import type { SocialProvider } from './keycloakBroker'

const KEY = 'pkce'

export interface PkceSession {
  codeVerifier: string
  state: string
  provider: SocialProvider
}

export const savePkce = (session: PkceSession): void => {
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export const consumePkce = (): PkceSession | null => {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PkceSession
  } catch {
    return null
  }
}
