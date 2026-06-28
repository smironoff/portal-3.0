import { Stack, Typography } from '@mui/material'
import { RegisterForm } from './components/RegisterForm'
import { SocialButtonsSection } from '@/features/auth/social/SocialButtonsSection'

export const RegisterScreen = () => (
  <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
    <Typography variant="h4">Create your account</Typography>
    <RegisterForm />
    <SocialButtonsSection />
    <Typography variant="caption" color="text.secondary">
      CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
    </Typography>
  </Stack>
)
