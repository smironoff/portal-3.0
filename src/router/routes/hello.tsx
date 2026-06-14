import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from './authenticated'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const Hello = () => {
  const { t } = useTranslation()
  return <Typography variant="h4">{t('hello', { name: 'Portal 3.0' })}</Typography>
}

export const HelloRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/hello',
  component: Hello,
})
