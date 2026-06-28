import { createRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetDoneScreen = () => {
  const { t } = useTranslation('auth')
  return (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="h5" gutterBottom>
        {t('reset.done.title')}
      </Typography>
      <Typography>{t('reset.done.body')}</Typography>
      <Typography sx={{ mt: 2 }}>
        <Link to="/account/login" search={{ error: undefined }}>{t('reset.done.backToLogin')}</Link>
      </Typography>
    </Box>
  )
}

export const ResetDoneRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/done',
  component: ResetDoneScreen,
})
