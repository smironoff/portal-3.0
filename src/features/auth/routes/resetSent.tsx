import { createRoute, Link } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetSentScreen = () => {
  const { email } = ResetSentRoute.useSearch()
  return (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="h5" gutterBottom>
        Check your email
      </Typography>
      <Typography>
        We have sent a password reset link to <strong>{email}</strong>. Please check your inbox and
        follow the instructions to reset your password.
      </Typography>
      <Typography sx={{ mt: 2 }}>
        <Link to="/account/login" search={{ error: undefined }}>Back to login</Link>
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
