import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { navigate, createSocialAccount, patch, clearSocial } = vi.hoisted(() => ({
  navigate: vi.fn(),
  createSocialAccount: vi.fn(),
  patch: vi.fn(),
  clearSocial: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

vi.mock('../api/countriesQueries', () => ({
  useCountries: () => ({
    data: [{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', used: true, organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }],
  }),
}))

vi.mock('../api/createAccount', () => ({ createSocialAccount }))

vi.mock('@/features/onboarding/state/onboardingStore', () => ({
  useOnboardingStore: (sel: (s: unknown) => unknown) => sel({ patch }),
}))

let socialDraft: unknown = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'a', refreshToken: 'r', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
  firstName: undefined,
  lastName: undefined,
}
vi.mock('../state/registrationStore', () => ({
  useRegistrationStore: (sel: (s: unknown) => unknown) => sel({ socialDraft, clearSocial }),
}))

import { SocialRegistrationForm } from './SocialRegistrationForm'

describe('SocialRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSocialAccount.mockResolvedValue({ applicationId: 7 })
  })

  it('collects name and DOB when the token lacks names, then creates and routes to onboarding', async () => {
    render(<SocialRegistrationForm />)
    // name fields visible because firstName/lastName are undefined
    await userEvent.type(screen.getByLabelText(/first name/i), 'Ada')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lovelace')
    await userEvent.type(screen.getByLabelText(/^day$/i), '1')
    await userEvent.type(screen.getByLabelText(/^month$/i), '2')
    await userEvent.type(screen.getByLabelText(/^year$/i), '1990')
    // select country
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Nigeria' }))
    await userEvent.click(screen.getByLabelText(/i agree to the terms/i))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' }))
    const arg = createSocialAccount.mock.calls[0][0]
    expect(arg.originCountry).toBe(158)
    expect(arg.portalAccountDomain).toBe('TMLC')
    expect(arg.preferredOrganization).toBe(14)
    expect(arg.firstName).toBe('Ada')
    expect(arg.day).toBe(1)
    expect(clearSocial).toHaveBeenCalled()
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 7, originCountry: 158 }))
  })
})
