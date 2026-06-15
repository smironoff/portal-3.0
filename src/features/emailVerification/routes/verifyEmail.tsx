import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { EmailVerificationScreen } from '@/features/emailVerification/EmailVerificationScreen'

export const VerifyEmailRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/account/verify-email',
  component: EmailVerificationScreen,
})
