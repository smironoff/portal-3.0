import { createRoute, Link } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetDoneScreen = () => (
  <Box sx={{ maxWidth: 400 }}>
    <Typography variant="h5" gutterBottom>
      Password reset successfully
    </Typography>
    <Typography>
      Your password has been reset. You may now sign in with your new credentials.
    </Typography>
    <Typography sx={{ mt: 2 }}>
      <Link to="/account/login" search={{ error: undefined }}>Back to login</Link>
    </Typography>
  </Box>
)

export const ResetDoneRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/done',
  component: ResetDoneScreen,
})
