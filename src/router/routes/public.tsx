import { createRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Route as RootRoute } from './__root'
import { Button } from '@/components/Button'
import { useSessionStore } from '@/state/sessionStore'

export const IndexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/account/login' })
  },
})

// eslint-disable-next-line react-refresh/only-export-components
const Login = () => {
  const navigate = useNavigate()
  return (
    <Button
      onClick={() => {
        useSessionStore.getState().setLoggedIn(true)
        void navigate({ to: '/hello' })
      }}
    >
      Dev sign in
    </Button>
  )
}

export const LoginRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/login',
  component: Login,
})
