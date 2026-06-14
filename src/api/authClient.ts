import type { AppConfig } from '@/config/schema'
import type { AuthTokens } from './types'
import { tokenStore } from './tokenStore'

export const TOKEN_EXPIRED_EVENT = 'TokenExpired'

export interface AuthClient {
  refreshOnce: () => Promise<boolean>
  notifyExpired: () => void
}

export function createAuthClient(config: AppConfig): AuthClient {
  let refreshPromise: Promise<boolean> | null = null

  async function updateTokens(): Promise<boolean> {
    const accessToken = tokenStore.getAccessToken()
    const refreshToken = tokenStore.getRefreshToken()
    if (!accessToken || !refreshToken) return false
    try {
      const res = await fetch(`${config.AUTH_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, refreshToken }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as { status: string; tokens?: AuthTokens }
      if (data.status === 'OK' && data.tokens) {
        tokenStore.setAuthTokens(data.tokens)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    refreshOnce() {
      if (refreshPromise) return refreshPromise
      refreshPromise = updateTokens().finally(() => {
        refreshPromise = null
      })
      return refreshPromise
    },
    notifyExpired() {
      tokenStore.clear()
      window.dispatchEvent(new Event(TOKEN_EXPIRED_EVENT))
    },
  }
}
