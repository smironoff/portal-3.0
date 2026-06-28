import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { SocialRegistrationForm } from '@/features/registration/components/SocialRegistrationForm'

export const SocialRegistrationRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/social-registration',
  component: SocialRegistrationForm,
})
