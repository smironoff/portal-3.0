import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { createAppTheme } from './theme'
import { useUIStore } from '@/state/uiStore'

const RTL_LANGS = ['ar', 'he', 'fa', 'ur']

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useUIStore((s) => s.themeMode)
  const brand = useUIStore((s) => s.brand)
  const language = useUIStore((s) => s.language)
  const isRtl = RTL_LANGS.includes(language)

  const cache = useMemo(
    () =>
      createCache({
        key: isRtl ? 'mui-rtl' : 'mui',
        stylisPlugins: isRtl ? [prefixer, rtlPlugin] : [prefixer],
      }),
    [isRtl]
  )
  const theme = useMemo(() => createAppTheme(themeMode, brand), [themeMode, brand])

  useEffect(() => {
    document.dir = isRtl ? 'rtl' : 'ltr'
  }, [isRtl])

  return (
    <CacheProvider value={cache}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </CacheProvider>
  )
}
