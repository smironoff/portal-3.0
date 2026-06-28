import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { PersonalInformationForm } from '@/features/registration/components/PersonalInformationForm'

export const PersonalInformationRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/personal-information',
  component: PersonalInformationForm,
})
