import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { RegisterScreen } from '@/features/registration/RegisterScreen'

export const RegisterRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/register',
  component: RegisterScreen,
})
