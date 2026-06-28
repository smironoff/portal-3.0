import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1 }, isLoading: false }),
  // Simulate a settled (errored) query: data is undefined, isLoading is false.
  useApplicationStatuses: () => ({ data: undefined, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
// Stub out the flow components so we do not need a QueryClientProvider in this unit test.
vi.mock('./flows/simplified/SimplifiedFlow', () => ({ SimplifiedFlow: () => <div>SimplifiedFlow</div> }))
vi.mock('./flows/general/GeneralFlow', () => ({ GeneralFlow: () => <div>GeneralFlow</div> }))
vi.mock('./flows/JurisdictionNotAvailable', () => ({
  JurisdictionNotAvailable: () => <div>JurisdictionNotAvailable</div>,
}))

beforeEach(() => navigate.mockReset())

describe('OnboardingScreen (status load error fallthrough)', () => {
  it('does not strand the user on loading when the status query rejects', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(screen.queryByText(/loading your application/i)).toBeNull()
  })

  it('does not navigate to the dashboard when status data is undefined', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(navigate).not.toHaveBeenCalledWith({ to: '/dashboard' })
  })
})
