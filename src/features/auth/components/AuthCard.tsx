import type { ReactNode } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { useUIStore } from '@/state/uiStore'
import logoLight from '@/assets/tm-portal-light.png'
import logoDark from '@/assets/tm-portal-dark.png'

// Centered auth surface: a single calm card on the theme background, crowned by
// the ThinkMarkets logo and a heading. The logo variant tracks the theme by its
// target background (see DashboardHeader).
export const AuthCard = ({ title, children }: { title: string; children: ReactNode }) => {
  const themeMode = useUIStore((s) => s.themeMode)
  const logo = themeMode === 'dark' ? logoDark : logoLight
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 400, borderRadius: 3, p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <Box component="img" src={logo} alt="ThinkMarkets" sx={{ height: 30 }} />
            <Typography variant="h5" fontWeight={600}>
              {title}
            </Typography>
          </Stack>
          {children}
        </Stack>
      </Paper>
    </Box>
  )
}
