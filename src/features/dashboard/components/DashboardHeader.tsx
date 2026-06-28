import { AppBar, Box, IconButton, Toolbar } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useUIStore } from '@/state/uiStore'
import { ThemeToggle } from './ThemeToggle'
import logoLight from '@/assets/tm-portal-light.png'
import logoDark from '@/assets/tm-portal-dark.png'

export const DRAWER_WIDTH = 240

export const DashboardHeader = () => {
  const themeMode = useUIStore((s) => s.themeMode)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  // Logo filenames are named by TARGET BACKGROUND, not ink colour:
  // light theme -> light background -> tm-portal-light.png (black "Think").
  const logo = themeMode === 'dark' ? logoDark : logoLight
  return (
    <AppBar position="fixed" color="default" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          aria-label="Open navigation"
          edge="start"
          color="inherit"
          onClick={toggleSidebar}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Box component="img" src={logo} alt="ThinkMarkets" sx={{ height: 28 }} />
        <Box sx={{ flexGrow: 1 }} />
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  )
}
