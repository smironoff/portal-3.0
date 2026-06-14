import { createRoute, redirect, Outlet } from '@tanstack/react-router'
import { Route as RootRoute } from './__root'
import { useSessionStore } from '@/state/sessionStore'

export const AuthenticatedRoute = createRoute({
  getParentRoute: () => RootRoute,
  id: 'authenticated',
  beforeLoad: () => {
    if (!useSessionStore.getState().loggedIn) {
      throw redirect({ to: '/account/login', search: { error: undefined } })
    }
  },
  component: () => <Outlet />,
})
