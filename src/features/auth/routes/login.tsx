import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const LoginRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/login',
  validateSearch: (s: Record<string, unknown>) => ({
    error: typeof s.error === 'string' ? s.error : undefined,
  }),
  component: LoginForm,
})
