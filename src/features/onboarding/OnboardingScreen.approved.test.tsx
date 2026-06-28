import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'APPROVED' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => navigate.mockReset())

describe('OnboardingScreen (approved)', () => {
  it('redirects an approved application to the dashboard', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' })
  })
})
