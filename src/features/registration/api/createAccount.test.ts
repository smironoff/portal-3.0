import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerUser = vi.fn()
const submitLevelOne = vi.fn()
const setAuthTokens = vi.fn()
vi.mock('@/features/auth/api/authApi', () => ({ registerUser }))
vi.mock('@/features/onboarding/api/onboardingApi', () => ({ submitLevelOne }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setAuthTokens, hasValidSession: () => false } }))

beforeEach(() => {
  registerUser.mockReset(); submitLevelOne.mockReset(); setAuthTokens.mockReset()
})

const input = {
  email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
  portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
  firstName: 'Test', lastName: 'User', day: 1, month: 1, year: 1990, title: 'Mr', recaptchaResponse: 'x',
}

describe('createSimplifiedAccount', () => {
  it('registers the auth user, stores tokens, sets logged in, then creates the application', async () => {
    registerUser.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } })
    submitLevelOne.mockResolvedValue({ applicationId: 999 })
    const { createSimplifiedAccount } = await import('./createAccount')
    const { useSessionStore } = await import('@/state/sessionStore')
    const out = await createSimplifiedAccount(input)
    expect(registerUser).toHaveBeenCalledWith(expect.objectContaining({ email_id: 'a@b.com', country: 158, account_holder_title: 'Mr' }))
    expect(setAuthTokens).toHaveBeenCalled()
    expect(useSessionStore.getState().loggedIn).toBe(true)
    expect(submitLevelOne).toHaveBeenCalledWith(expect.objectContaining({
      accountHolderEmail: 'a@b.com', originCountry: 158, accountHolderFirstName: 'Test',
      accountHolderDayOfBirth: 1, recaptchaResponse: 'x',
    }))
    expect(out.applicationId).toBe(999)
  })

  it('throws and does not create the application when auth registration fails', async () => {
    registerUser.mockResolvedValue({ status: 'ASE-008', code: 'ASE-008' })
    const { createSimplifiedAccount } = await import('./createAccount')
    await expect(createSimplifiedAccount(input)).rejects.toThrow()
    expect(submitLevelOne).not.toHaveBeenCalled()
  })
})
