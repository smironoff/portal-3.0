import type { AuthTokens } from './types'

// Exact keys from legacy src/utils/enums.ts __STORAGE — kept identical so an
// existing logged-in session in the same origin remains valid after cutover.
export const STORAGE_KEYS = {
  session: '_ss__',
  token: '___t',
  accessToken: '__at_',
  refreshToken: '__rt_',
  idToken: '__it_',
  validUntil: 'vu',
} as const

function read(key: string): string {
  return localStorage.getItem(key) ?? ''
}

export const tokenStore = {
  getAccessToken: () => read(STORAGE_KEYS.accessToken),
  getRefreshToken: () => read(STORAGE_KEYS.refreshToken),
  getIdToken: () => read(STORAGE_KEYS.idToken),
  getTfboSession: () => read(STORAGE_KEYS.session),
  getTfboToken: () => read(STORAGE_KEYS.token),

  setTfbo(session: string, token: string) {
    localStorage.setItem(STORAGE_KEYS.session, session)
    localStorage.setItem(STORAGE_KEYS.token, token)
  },

  setAuthTokens(tokens: AuthTokens) {
    localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken)
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken)
    if (tokens.idToken) localStorage.setItem(STORAGE_KEYS.idToken, tokens.idToken)
    localStorage.setItem(STORAGE_KEYS.validUntil, tokens.refreshTokenValidUntil)
  },

  clear() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k))
  },
}
