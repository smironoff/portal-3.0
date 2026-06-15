import { createRoute, redirect } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { RegisterScreen } from '@/features/registration/RegisterScreen'
import { useSessionStore } from '@/state/sessionStore'

export const RegisterRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/register',
  beforeLoad: () => {
    if (useSessionStore.getState().loggedIn) throw redirect({ to: '/onboarding' })
  },
  component: RegisterScreen,
})
