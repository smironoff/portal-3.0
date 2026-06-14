import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { I18nextProvider } from 'react-i18next'
import type { AppConfig } from '@/config/schema'
import { ConfigProvider } from '@/config/ConfigProvider'
import { AppThemeProvider } from '@/theme/ThemeProvider'
import { createQueryClient, registerTokenExpiredHandler } from '@/api/queryClient'
import { useSessionStore } from '@/state/sessionStore'
import { SentryErrorBoundary } from '@/observability/sentry'
import { router } from '@/router/router'
import i18n from '@/i18n/i18n'

const queryClient = createQueryClient()

export default function App({ config }: { config: AppConfig }) {
  useEffect(
    () => registerTokenExpiredHandler(queryClient, () => useSessionStore.getState().reset()),
    [],
  )
  return (
    <SentryErrorBoundary fallback={<div role="alert">Application error</div>}>
      <ConfigProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <AppThemeProvider>
              <RouterProvider router={router} />
            </AppThemeProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </ConfigProvider>
    </SentryErrorBoundary>
  )
}
