import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { EmploymentStatusStep } from './EmploymentStatusStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('EmploymentStatusStep', () => {
  it('requires an explicit selection, then writes both fields and advances', async () => {
    const onNext = vi.fn()
    render(<EmploymentStatusStep onNext={onNext} canGoBack={false} />)
    // Open the select and choose an explicit option.
    await userEvent.click(screen.getByLabelText('Employment status'))
    await userEvent.click(screen.getByRole('option', { name: 'Employed' }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    const draft = useOnboardingStore.getState().draft
    expect(draft.accountHolderEmploymentStatus).toBe('Employed')
    expect(draft.employmentStatus).toBe('Employed')
  })
})
