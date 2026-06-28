// src/features/auth/components/SocialCallback.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const exchangeCodeForTokens = vi.hoisted(() => vi.fn())
const decodeIdTokenClaims = vi.hoisted(() => vi.fn())
vi.mock('../social/keycloakBroker', () => ({ exchangeCodeForTokens, decodeIdTokenClaims }))

const checkProfileStatus = vi.hoisted(() => vi.fn())
vi.mock('../api/socialApi', () => ({ checkProfileStatus }))

const consumePkce = vi.hoisted(() => vi.fn())
vi.mock('../social/pkceStore', () => ({ consumePkce }))
vi.mock('../social/initiateSocialLogin', () => ({ socialCallbackUri: () => 'https://app.test/account/callback' }))

const setAuthTokens = vi.hoisted(() => vi.fn())
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setAuthTokens, hasValidSession: () => false } }))
const setLoggedIn = vi.hoisted(() => vi.fn())
vi.mock('@/state/sessionStore', () => ({ useSessionStore: { getState: () => ({ setLoggedIn }) } }))
vi.mock('../api/authApi', () => ({ getUserProfile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../landing', () => ({ resolveLandingRoute: () => '/onboarding' }))

const setSocialDraft = vi.hoisted(() => vi.fn())
vi.mock('@/features/registration/state/registrationStore', () => ({
  useRegistrationStore: (sel: (s: unknown) => unknown) => sel({ setSocialDraft }),
}))

import { SocialCallback } from './SocialCallback'

const setUrl = (search: string) =>
  Object.defineProperty(window, 'location', { value: { href: `https://app.test/account/callback${search}` }, writable: true })

const tokens = { accessToken: 'KA', refreshToken: 'KR', idToken: 'IT', refreshTokenValidUntil: '2030' }

describe('SocialCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consumePkce.mockReturnValue({ codeVerifier: 'v', state: 'st', provider: 'apple' })
    exchangeCodeForTokens.mockResolvedValue(tokens)
  })

  it('returning user: stores tokens, logs in, lands', async () => {
    setUrl('?code=c&state=st')
    checkProfileStatus.mockResolvedValue({ needsCompletion: false })
    render(<SocialCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' }))
    expect(setAuthTokens).toHaveBeenCalledWith(tokens)
    expect(setLoggedIn).toHaveBeenCalledWith(true)
    expect(setSocialDraft).not.toHaveBeenCalled()
  })

  it('new user: seeds the social draft and routes to social registration', async () => {
    setUrl('?code=c&state=st')
    checkProfileStatus.mockResolvedValue({ needsCompletion: true })
    decodeIdTokenClaims.mockReturnValue({ email: 'a@b.com', firstName: undefined, lastName: undefined })
    render(<SocialCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/account/social-registration' }))
    expect(setSocialDraft).toHaveBeenCalledWith({
      provider: 'apple',
      idToken: 'IT',
      keycloakTokens: tokens,
      email: 'a@b.com',
      firstName: undefined,
      lastName: undefined,
    })
    expect(setLoggedIn).not.toHaveBeenCalled()
  })

  it('state mismatch: shows an error and does not navigate', async () => {
    setUrl('?code=c&state=WRONG')
    render(<SocialCallback />)
    await waitFor(() => expect(screen.getByText(/could not complete/i)).toBeInTheDocument())
    expect(navigate).not.toHaveBeenCalled()
    expect(exchangeCodeForTokens).not.toHaveBeenCalled()
  })
})
