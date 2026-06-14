import { createRootRoute, Outlet } from '@tanstack/react-router'
import { SessionGuard } from '@/features/auth/SessionGuard'

export const Route = createRootRoute({
  component: () => (
    <>
      <SessionGuard />
      <Outlet />
    </>
  ),
  errorComponent: ({ error }) => <div role="alert">Something went wrong: {String(error)}</div>,
})
