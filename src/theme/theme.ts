import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { lightTokens, darkTokens, breakpoints, ibAccent } from './tokens'
import type { ThemeMode, Brand } from '@/state/uiStore'

export const createAppTheme = (mode: ThemeMode, brand: Brand): Theme => {
  const t = mode === 'dark' ? darkTokens : lightTokens
  return createTheme({
    palette: {
      mode,
      primary: { main: brand === 'ib' ? ibAccent : t.accent },
      error: { main: t.error },
      success: { main: t.success },
      background: { default: t.background, paper: t.cardBackground },
      text: { primary: t.text },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: breakpoints.mobile,
        md: breakpoints.tablet,
        lg: breakpoints.laptop,
        xl: 1536,
      },
    },
    typography: {
      fontFamily: ['Figtree', 'Noto Sans JP', 'Noto Sans SC', 'sans-serif'].join(','),
    },
  })
}
