import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { TwoFactorForm } from '@/features/auth/components/TwoFactorForm'

// eslint-disable-next-line react-refresh/only-export-components
const TwoFactorScreen = () => {
  const { email } = TwoFactorRoute.useSearch()
  return <TwoFactorForm email={email} />
}

export const TwoFactorRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/login/check',
  validateSearch: (s: Record<string, unknown>) => ({ email: String(s.email ?? '') }),
  component: TwoFactorScreen,
})
