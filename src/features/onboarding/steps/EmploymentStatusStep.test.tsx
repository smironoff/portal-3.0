import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { EmploymentStatusStep } from './EmploymentStatusStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('EmploymentStatusStep', () => {
  it('defaults to a valid selection, writes both fields, advances', async () => {
    const onNext = vi.fn()
    render(<EmploymentStatusStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    const draft = useOnboardingStore.getState().draft
    expect(draft.accountHolderEmploymentStatus).toBeTruthy()
    expect(draft.employmentStatus).toBe(draft.accountHolderEmploymentStatus)
  })
})
