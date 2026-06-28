import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
const createSimplifiedAccount = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('../api/createAccount', () => ({ createSimplifiedAccount }))
vi.mock('@/features/auth/hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))

beforeEach(() => {
  navigate.mockReset(); createSimplifiedAccount.mockReset()
})

const seedDraft = async () => {
  const { useRegistrationStore } = await import('../state/registrationStore')
  useRegistrationStore.getState().setDraft({
    email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
    portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
  })
}

describe('PersonalInformationForm', () => {
  it('redirects to register when there is no draft', async () => {
    const { useRegistrationStore } = await import('../state/registrationStore')
    useRegistrationStore.getState().clear()
    const { PersonalInformationForm } = await import('./PersonalInformationForm')
    render(<PersonalInformationForm />)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/register' })
  })

  it('creates the account and navigates to onboarding', async () => {
    await seedDraft()
    createSimplifiedAccount.mockResolvedValue({ applicationId: 999 })
    const { PersonalInformationForm } = await import('./PersonalInformationForm')
    render(<PersonalInformationForm />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
    await userEvent.type(screen.getByLabelText(/last name/i), 'User')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '1')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(createSimplifiedAccount).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@b.com', originCountry: 158, firstName: 'Test', lastName: 'User', day: 1, month: 1, year: 1990, recaptchaResponse: 'cap',
    }))
    expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' })
  })
})
