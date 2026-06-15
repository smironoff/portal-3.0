import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'

export const OnboardingRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/onboarding',
  component: OnboardingScreen,
})
