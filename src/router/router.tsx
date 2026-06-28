import { createRouter } from '@tanstack/react-router'
import { Route as RootRoute } from './routes/__root'
import { IndexRoute } from './routes/public'
import { AuthenticatedRoute } from './routes/authenticated'
import { OnboardingRoute } from '@/features/onboarding/routes/onboarding'
import { LoginRoute } from '@/features/auth/routes/login'
import { RegisterRoute } from '@/features/registration/routes/register'
import { PersonalInformationRoute } from '@/features/registration/routes/personalInformation'
import { TwoFactorRoute } from '@/features/auth/routes/twoFactor'
import { ResetRequestRoute } from '@/features/auth/routes/resetRequest'
import { ResetSentRoute } from '@/features/auth/routes/resetSent'
import { ResetConfirmRoute } from '@/features/auth/routes/resetConfirm'
import { ResetDoneRoute } from '@/features/auth/routes/resetDone'
import { VerifyEmailRoute } from '@/features/emailVerification/routes/verifyEmail'
import { dashboardRouteTree } from '@/features/dashboard/routes/dashboard'

const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  RegisterRoute,
  PersonalInformationRoute,
  TwoFactorRoute,
  ResetRequestRoute,
  ResetSentRoute,
  ResetConfirmRoute,
  ResetDoneRoute,
  AuthenticatedRoute.addChildren([OnboardingRoute, VerifyEmailRoute, dashboardRouteTree]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/router-core' {
  interface Register {
    router: typeof router
  }
}
