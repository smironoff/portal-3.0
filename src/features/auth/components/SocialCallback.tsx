// src/features/auth/components/SocialCallback.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link as RouterLink } from '@tanstack/react-router'
import { Stack, Typography, Link } from '@mui/material'
import { consumePkce } from '../social/pkceStore'
import { exchangeCodeForTokens, decodeIdTokenClaims } from '../social/keycloakBroker'
import { socialCallbackUri } from '../social/initiateSocialLogin'
import { checkProfileStatus } from '../api/socialApi'
import { getUserProfile } from '../api/authApi'
import { resolveLandingRoute } from '../landing'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { useRegistrationStore } from '@/features/registration/state/registrationStore'

export const SocialCallback = () => {
  const navigate = useNavigate()
  const setSocialDraft = useRegistrationStore((s) => s.setSocialDraft)
  const [error, setError] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const run = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const hasError = url.searchParams.get('error')
      const pkce = consumePkce()
      if (hasError || !code || !pkce || returnedState !== pkce.state) {
        setError(true)
        return
      }
      try {
        const tokens = await exchangeCodeForTokens(code, pkce.codeVerifier, socialCallbackUri())
        const idToken = tokens.idToken ?? ''
        const status = await checkProfileStatus(idToken)
        if (!status.needsCompletion) {
          tokenStore.setAuthTokens(tokens)
          useSessionStore.getState().setLoggedIn(true)
          const profile = await getUserProfile().catch(() => undefined)
          navigate({ to: resolveLandingRoute(profile) })
          return
        }
        const claims = decodeIdTokenClaims(idToken)
        setSocialDraft({
          provider: pkce.provider,
          idToken,
          keycloakTokens: tokens,
          email: claims.email,
          firstName: claims.firstName,
          lastName: claims.lastName,
        })
        navigate({ to: '/account/social-registration' })
      } catch {
        setError(true)
      }
    }
    void run()
  }, [navigate, setSocialDraft])

  if (error) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
        <Typography>We could not complete your sign in. Please try again.</Typography>
        <Link component={RouterLink} to="/account/register" underline="hover">
          Back to sign in
        </Link>
      </Stack>
    )
  }
  return <Typography sx={{ mt: 4, textAlign: 'center' }}>Completing your sign in...</Typography>
}
