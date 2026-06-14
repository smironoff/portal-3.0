import { createRouter } from '@tanstack/react-router'
import { Route as RootRoute } from './routes/__root'
import { IndexRoute, LoginRoute } from './routes/public'
import { AuthenticatedRoute } from './routes/authenticated'
import { HelloRoute } from './routes/hello'

const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  AuthenticatedRoute.addChildren([HelloRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/router-core' {
  interface Register {
    router: typeof router
  }
}
