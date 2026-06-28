import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: null, isLoading: false }),
  useApplicationStatuses: () => ({ data: [{ application_status: 'INCOMPLETE' }], isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('./flows/simplified/SimplifiedFlow', () => ({ SimplifiedFlow: () => <div>SimplifiedFlow</div> }))
vi.mock('./flows/general/GeneralFlow', () => ({ GeneralFlow: () => <div>GeneralFlow</div> }))
vi.mock('./flows/JurisdictionNotAvailable', () => ({
  JurisdictionNotAvailable: () => <div>JurisdictionNotAvailable</div>,
}))

beforeEach(async () => {
  const { useOnboardingStore } = await import('./state/onboardingStore')
  useOnboardingStore.getState().reset()
  // seed the draft as the Personal Information screen would, for a TMLC applicant
  useOnboardingStore.getState().patch({ applicationId: 999, portalAccountDomain: 'TMLC' })
})

describe('OnboardingScreen (fresh application, empty getLastApplicationsInfo)', () => {
  it('does not strand on loading and renders the simplified flow', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(screen.queryByText(/loading your application/i)).toBeNull()
  })
})
