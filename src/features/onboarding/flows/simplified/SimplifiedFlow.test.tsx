import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnboardingStore } from '../../state/onboardingStore'

const submitLevelOne = vi.fn()
vi.mock('../../api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'INCOMPLETE' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: submitLevelOne }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))

beforeEach(() => {
  useOnboardingStore.getState().reset()
  submitLevelOne.mockReset()
  submitLevelOne.mockResolvedValue({ applicationId: 1 })
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
