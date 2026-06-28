import { useNavigate } from '@tanstack/react-router'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'

// Local-only logout: clears stored tokens, drops the session flag, and returns
// to login. Fail-safe — the session is always cleared and the user redirected
// even if clearing storage throws, so a user can never be left stuck signed in.
// (Backend session invalidation is deferred to a later slice.)
export const useLogout = (): (() => void) => {
  const navigate = useNavigate()
  return () => {
    try {
      tokenStore.clear()
    } catch {
      // Swallow the error - fail-safe logout still proceeds
    } finally {
      useSessionStore.getState().reset()
      navigate({ to: '/account/login', search: { error: undefined } })
    }
  }
}
