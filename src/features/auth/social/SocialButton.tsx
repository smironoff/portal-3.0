import { Button } from '@mui/material'
import { initiateSocialLogin } from './initiateSocialLogin'
import type { SocialProvider } from './keycloakBroker'

const LABELS: Record<SocialProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
}

export const SocialButton = ({ provider }: { provider: SocialProvider }) => (
  <Button fullWidth variant="outlined" onClick={() => void initiateSocialLogin(provider)}>
    {LABELS[provider]}
  </Button>
)
