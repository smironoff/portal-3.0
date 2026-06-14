import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
  errorComponent: ({ error }) => <div role="alert">Something went wrong: {String(error)}</div>,
})
