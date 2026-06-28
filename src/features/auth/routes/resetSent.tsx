import { createRoute, Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetSentScreen = () => {
  const { t } = useTranslation('auth')
  const { email } = ResetSentRoute.useSearch()
  return (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="h5" gutterBottom>
        {t('reset.sent.title')}
      </Typography>
      <Typography>
        <Trans i18nKey="reset.sent.body" t={t} values={{ email }} components={{ 1: <strong /> }} />
      </Typography>
      <Typography sx={{ mt: 2 }}>
        <Link to="/account/login" search={{ error: undefined }}>{t('reset.sent.backToLogin')}</Link>
      </Typography>
    </Box>
  )
}

export const ResetSentRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/sent',
  validateSearch: (s: Record<string, unknown>) => ({ email: String(s.email ?? '') }),
  component: ResetSentScreen,
})
