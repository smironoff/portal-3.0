import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { PasswordResetRequestForm } from '@/features/auth/components/PasswordResetRequestForm'

export const ResetRequestRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset',
  component: PasswordResetRequestForm,
})
