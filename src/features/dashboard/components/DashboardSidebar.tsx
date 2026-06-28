import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { NAV_ITEMS } from '../nav'
import { useLogout } from '../useLogout'
import { useUIStore } from '@/state/uiStore'
import { DRAWER_WIDTH } from './DashboardHeader'

const NavList = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const { pathname } = useLocation()
  const logout = useLogout()
  return (
    <>
      <Toolbar />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List sx={{ flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <ListItemButton
                key={item.key}
                selected={pathname === item.path}
                onClick={() => onNavigate(item.path)}
              >
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            )
          })}
        </List>
        <List>
          <ListItemButton onClick={logout}>
            <ListItemIcon>
              <LogoutOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Log out" />
          </ListItemButton>
        </List>
      </Box>
    </>
  )
}

export const DashboardSidebar = () => {
  const navigate = useNavigate()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const goPermanent = (path: string) => navigate({ to: path })
  const goTemporary = (path: string) => {
    navigate({ to: path })
    toggleSidebar() // close the mobile drawer after navigating
  }

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={toggleSidebar}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <NavList onNavigate={goTemporary} />
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <NavList onNavigate={goPermanent} />
      </Drawer>
    </Box>
  )
}
