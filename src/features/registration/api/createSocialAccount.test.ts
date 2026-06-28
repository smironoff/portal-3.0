import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/auth/api/socialApi')
vi.mock('@/features/onboarding/api/onboardingApi')
vi.mock('@/api/tokenStore')
vi.mock('@/state/sessionStore')

import { createSocialAccount } from './createAccount'
import { socialRegister } from '@/features/auth/api/socialApi'
import { submitLevelOne } from '@/features/onboarding/api/onboardingApi'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import type { SocialDraft } from '../state/registrationStore'

const mockSocialRegister = vi.mocked(socialRegister)
const mockSubmitLevelOne = vi.mocked(submitLevelOne)
const mockTokenStore = vi.mocked(tokenStore, true)
const mockUseSessionStore = vi.mocked(useSessionStore, true)

const social: SocialDraft = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'KA', refreshToken: 'KR', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
}

const baseInput = {
  social,
  originCountry: 158,
  preferredOrganization: 14,
  portalAccountDomain: 'TMLC',
  preferredLanguage: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  title: 'Mr',
  agreeToAllTerms: true,
  isMarketingOptOut: false,
}

describe('createSocialAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubmitLevelOne.mockResolvedValue({ applicationId: 42 })

    const mockSetLoggedIn = vi.fn()
    mockUseSessionStore.getState = vi.fn(() => ({ setLoggedIn: mockSetLoggedIn }))
  })

  it('registers, stores returned portal tokens, sets logged in, and creates the application without a password', async () => {
    mockSocialRegister.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2031' } })

    const result = await createSocialAccount({ ...baseInput, day: 1, month: 2, year: 1990 })

    expect(mockSocialRegister).toHaveBeenCalledWith('IT', {
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    expect(mockTokenStore.setAuthTokens).toHaveBeenCalledWith({ accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2031' })

    const setLoggedInMock = mockUseSessionStore.getState().setLoggedIn
    expect(setLoggedInMock).toHaveBeenCalledWith(true)

    const payload = mockSubmitLevelOne.mock.calls[0][0]
    expect(payload.accountHolderPassword).toBeUndefined()
    expect(payload.recaptchaResponse).toBeUndefined()
    expect(payload.accountHolderDayOfBirth).toBe(1)
    expect(payload.accountType).toBe('individual')
    expect(result).toEqual({ applicationId: 42 })
  })

  it('falls back to the Keycloak tokens when the register response carries none', async () => {
    mockSocialRegister.mockResolvedValue({ status: 'OK' })
    await createSocialAccount(baseInput)
    expect(mockTokenStore.setAuthTokens).toHaveBeenCalledWith(social.keycloakTokens)
  })

  it('throws and does not create the application when the register returns an error code', async () => {
    mockSocialRegister.mockResolvedValue({ status: 'ASE-008', code: 'ASE-008' })
    await expect(createSocialAccount(baseInput)).rejects.toThrow('Social registration failed: ASE-008')
    expect(mockSubmitLevelOne).not.toHaveBeenCalled()
  })

  it('throws and does not call submitLevelOne or setAuthTokens when the register returns a non-OK status with no code', async () => {
    mockSocialRegister.mockResolvedValue({ status: 'NOK' })
    await expect(createSocialAccount(baseInput)).rejects.toThrow('Social registration failed: NOK')
    expect(mockSubmitLevelOne).not.toHaveBeenCalled()
    expect(mockTokenStore.setAuthTokens).not.toHaveBeenCalled()
  })
})
