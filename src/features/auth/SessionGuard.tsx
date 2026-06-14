import { useNavigate } from '@tanstack/react-router'
import { useConfig } from '@/config/ConfigProvider'
import { useSessionStore } from '@/state/sessionStore'
import { useUserProfile } from './api/authQueries'
import { useInactivityTimeout } from './hooks/useInactivityTimeout'
import { keepSignedIn } from './keepSignedIn'
import { tokenStore } from '@/api/tokenStore'

export const SessionGuard = () => {
  const loggedIn = useSessionStore((s) => s.loggedIn)
  const config = useConfig()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile(loggedIn)
  const minutes = Number(profile?.additionalAttributes?.inactivityTimeout ?? config.LOGOUT_AFTER_MIN)

  useInactivityTimeout({
    minutes,
    enabled: loggedIn && !keepSignedIn.get(),
    onTimeout: () => {
      tokenStore.clear()
      useSessionStore.getState().reset()
      void navigate({ to: '/account/login', search: { error: undefined } })
    },
  })
  return null
}
