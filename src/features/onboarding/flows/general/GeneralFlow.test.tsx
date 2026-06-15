import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOnboardingStore } from '../../state/onboardingStore'
import type { StepField, StepComponentProps } from '../../engine/stepConfig'

const incremental = vi.fn().mockResolvedValue({ applicationStatus: 'INCOMPLETE', applicationId: 1 })
vi.mock('../../api/onboardingQueries', () => ({
  useIncrementalSubmit: () => ({ mutateAsync: incremental }),
}))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const Ok = ({ onNext }: StepComponentProps) => <button onClick={onNext}>Continue</button>
const Fail = () => <div>FAILURE PAGE</div>

beforeEach(() => { useOnboardingStore.getState().reset(); incremental.mockClear() })

describe('GeneralFlow', () => {
  it('renders the failure step when a beforeSubmit sets appropriatenessLevel FAIL', async () => {
    const steps: StepField[] = [
      { fields: [], component: Ok, category: 'assessment', isLast: true, beforeSubmit: (d) => ({ ...d, appropriatenessLevel: 'FAIL' }) },
      { fields: [], component: Fail, category: 'assessment', isFailure: true },
    ]
    const { GeneralFlow } = await import('./GeneralFlow')
    render(<GeneralFlow steps={steps} applicationId={1} questions={[]} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText('FAILURE PAGE')).toBeInTheDocument()
  })
})
