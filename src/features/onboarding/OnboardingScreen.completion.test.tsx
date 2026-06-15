import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()

// vi.hoisted so mock fns are available inside the factory closures below
const { mockIsEmailVerificationRequired, mockIsUserVerified } = vi.hoisted(() => ({
  mockIsEmailVerificationRequired: vi.fn(),
  mockIsUserVerified: vi.fn(),
}))

vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'PENDING_KYC' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@/features/auth/api/authQueries', () => ({
  useUserProfile: () => ({ data: { country: { id: 1 }, email: 'a@b.com' } }),
}))
vi.mock('@/features/emailVerification/api/emailQueries', () => ({
  useIsEmailVerificationRequired: (countryId: number) => mockIsEmailVerificationRequired(countryId),
  useIsUserVerified: (email: string) => mockIsUserVerified(email),
}))

beforeEach(() => {
  navigate.mockReset()
  mockIsEmailVerificationRequired.mockReturnValue({ data: true, isLoading: false })
  mockIsUserVerified.mockReturnValue({ data: false, isLoading: false })
})

describe('OnboardingScreen completion', () => {
  it('offers email verification once the application is pending KYC', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    await userEvent.click(screen.getByRole('button', { name: /verify your email/i }))
    expect(navigate).toHaveBeenCalledWith({ to: '/account/verify-email' })
  })

  it('hides the email verification button when email verification is not required', async () => {
    mockIsEmailVerificationRequired.mockReturnValue({ data: false, isLoading: false })
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(screen.queryByRole('button', { name: /verify your email/i })).not.toBeInTheDocument()
  })

  it('shows the email verification button when required-check is uncertain (fail-closed)', async () => {
    mockIsEmailVerificationRequired.mockReturnValue({ data: undefined, isLoading: false })
    mockIsUserVerified.mockReturnValue({ data: false, isLoading: false })
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(screen.getByRole('button', { name: /verify your email/i })).toBeInTheDocument()
  })
})
