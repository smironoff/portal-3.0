import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { DashboardShell } from '@/features/dashboard/DashboardShell'
import { PlaceholderScreen } from '@/features/dashboard/screens/PlaceholderScreen'

export const DashboardLayoutRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/dashboard',
  component: DashboardShell,
})

const AccountsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: '/',
  component: () => <PlaceholderScreen title="Accounts" />,
})
const FundsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'funds',
  component: () => <PlaceholderScreen title="Funds" />,
})
const DownloadsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'downloads',
  component: () => <PlaceholderScreen title="Downloads" />,
})
const ToolsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'tools',
  component: () => <PlaceholderScreen title="Tools" />,
})
const SupportRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'support',
  component: () => <PlaceholderScreen title="Support" />,
})

export const dashboardRouteTree = DashboardLayoutRoute.addChildren([
  AccountsRoute,
  FundsRoute,
  DownloadsRoute,
  ToolsRoute,
  SupportRoute,
])
