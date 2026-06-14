import { createRoute, redirect } from '@tanstack/react-router'
import { Route as RootRoute } from './__root'

export const IndexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/account/login', search: { error: undefined } })
  },
})
