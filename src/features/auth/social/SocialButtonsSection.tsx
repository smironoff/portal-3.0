import { Stack, Divider } from '@mui/material'
import { SocialButton } from './SocialButton'

export const SocialButtonsSection = () => (
  <Stack spacing={1}>
    <Divider>or</Divider>
    <SocialButton provider="google" />
    <SocialButton provider="apple" />
  </Stack>
)
