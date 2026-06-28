// src/features/auth/routes/callback.tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { SocialCallback } from '@/features/auth/components/SocialCallback'

export const CallbackRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/callback',
  component: SocialCallback,
})
