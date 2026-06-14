import { createRouter } from '@tanstack/react-router'
import { Route as RootRoute } from './routes/__root'
import { IndexRoute } from './routes/public'
import { AuthenticatedRoute } from './routes/authenticated'
import { HelloRoute } from './routes/hello'
import { LoginRoute } from '@/features/auth/routes/login'
import { TwoFactorRoute } from '@/features/auth/routes/twoFactor'
import { ResetRequestRoute } from '@/features/auth/routes/resetRequest'
import { ResetSentRoute } from '@/features/auth/routes/resetSent'
import { ResetConfirmRoute } from '@/features/auth/routes/resetConfirm'
import { ResetDoneRoute } from '@/features/auth/routes/resetDone'

const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  TwoFactorRoute,
  ResetRequestRoute,
  ResetSentRoute,
  ResetConfirmRoute,
  ResetDoneRoute,
  AuthenticatedRoute.addChildren([HelloRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/router-core' {
  interface Register {
    router: typeof router
  }
}
