import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnboardingStore } from '../../state/onboardingStore'

const submitLevelOne = vi.fn()
const submitLevelTwo = vi.fn()
vi.mock('../../api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'INCOMPLETE' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: submitLevelOne }),
  useSubmitLevelTwo: () => ({ mutateAsync: submitLevelTwo }),
}))

beforeEach(() => {
  useOnboardingStore.getState().reset()
  submitLevelOne.mockReset()
  submitLevelOne.mockResolvedValue({ applicationId: 1 })
  submitLevelTwo.mockReset()
  submitLevelTwo.mockResolvedValue({ applicationId: 1 })
})

describe('SimplifiedFlow level 1', () => {
  it('walks the level-1 steps and submits at the end', async () => {
    const { SimplifiedFlow } = await import('./SimplifiedFlow')
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <SimplifiedFlow status="INCOMPLETE" applicationId={1} />
      </QueryClientProvider>,
    )

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jo')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lee')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '2')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // non-final step advance must use submitLevelOne (not the incremental mutation)
    expect(submitLevelOne).toHaveBeenCalledTimes(1)
    expect(submitLevelOne).not.toHaveBeenCalledWith(expect.objectContaining({ completed: true }))

    await userEvent.type(screen.getByLabelText(/country code/i), '44')
    await userEvent.type(screen.getByLabelText(/phone number/i), '7700900000')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // platform step has defaults -> just continue
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // terms
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /continue|submit/i }))

    // final step must call submitLevelOne with completed: true
    expect(submitLevelOne).toHaveBeenLastCalledWith(expect.objectContaining({ completed: true }))
  })
})

describe('SimplifiedFlow level 2', () => {
  it('does not send appropriatenessLevel on a non-final Level 2 step advance', async () => {
    // Set organizationId in the store so the Level 2 guard passes
    useOnboardingStore.getState().patch({ organizationId: 42 })

    const { SimplifiedFlow } = await import('./SimplifiedFlow')
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <SimplifiedFlow status="LEVEL1_APPROVED" applicationId={1} />
      </QueryClientProvider>,
    )

    // First Level 2 step is AddressStep (non-final) — fill postcode and continue
    await userEvent.type(screen.getByLabelText(/postcode/i), 'SW1A 1AA')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // submitLevelTwo must have been called once for the non-final advance
    expect(submitLevelTwo).toHaveBeenCalledTimes(1)
    // Must NOT carry appropriatenessLevel on an intermediate step
    expect(submitLevelTwo).not.toHaveBeenCalledWith(expect.objectContaining({ appropriatenessLevel: expect.anything() }))
    // Must NOT carry completed: true on an intermediate step
    expect(submitLevelTwo).not.toHaveBeenCalledWith(expect.objectContaining({ completed: true }))
  })
})
