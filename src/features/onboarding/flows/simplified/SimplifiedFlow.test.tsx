import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnboardingStore } from '../../state/onboardingStore'

const submitLevelOne = vi.fn()
const incremental = vi.fn().mockResolvedValue({ applicationStatus: 'INCOMPLETE', applicationId: 1 })
vi.mock('../../api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'INCOMPLETE' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: incremental }),
  useSubmitLevelOne: () => ({ mutateAsync: submitLevelOne }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))

beforeEach(() => {
  useOnboardingStore.getState().reset()
  submitLevelOne.mockReset()
  submitLevelOne.mockResolvedValue({ applicationId: 1 })
  incremental.mockClear()
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

    await userEvent.type(screen.getByLabelText(/country code/i), '44')
    await userEvent.type(screen.getByLabelText(/phone number/i), '7700900000')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // platform step has defaults -> just continue
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    // terms
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /continue|submit/i }))

    expect(submitLevelOne).toHaveBeenCalled()
  })
})
