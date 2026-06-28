import { Box, Toolbar } from '@mui/material'
import { Outlet } from '@tanstack/react-router'
import { DashboardHeader, DRAWER_WIDTH } from './components/DashboardHeader'
import { DashboardSidebar } from './components/DashboardSidebar'

export const DashboardShell = () => (
  <Box sx={{ display: 'flex' }}>
    <DashboardHeader />
    <DashboardSidebar />
    <Box
      component="main"
      sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}
    >
      <Toolbar />
      <Outlet />
    </Box>
  </Box>
)
