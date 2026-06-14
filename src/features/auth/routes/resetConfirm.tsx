import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { PasswordResetConfirmForm } from '@/features/auth/components/PasswordResetConfirmForm'

// eslint-disable-next-line react-refresh/only-export-components
const ResetConfirmScreen = () => {
  const { token } = ResetConfirmRoute.useSearch()
  return <PasswordResetConfirmForm token={token} />
}

export const ResetConfirmRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/new',
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? '') }),
  component: ResetConfirmScreen,
})
