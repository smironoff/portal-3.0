import {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthUrl,
  type SocialProvider,
} from './keycloakBroker'
import { savePkce } from './pkceStore'

export const socialCallbackUri = (): string => `${window.location.origin}/account/callback`

export const initiateSocialLogin = async (provider: SocialProvider): Promise<void> => {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await deriveCodeChallenge(codeVerifier)
  const state = generateCodeVerifier()
  savePkce({ codeVerifier, state, provider })
  window.location.assign(buildAuthUrl({ provider, redirectUri: socialCallbackUri(), state, codeChallenge }))
}
