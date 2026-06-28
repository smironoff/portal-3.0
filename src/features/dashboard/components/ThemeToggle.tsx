import { IconButton } from '@mui/material'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useUIStore } from '@/state/uiStore'

export const ThemeToggle = () => {
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  return (
    <IconButton
      aria-label="Toggle theme"
      color="inherit"
      onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
    >
      {themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
    </IconButton>
  )
}
