import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { PersonalInfoStep } from './PersonalInfoStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('PersonalInfoStep', () => {
  it('writes fields to the draft and advances', async () => {
    const onNext = vi.fn()
    render(<PersonalInfoStep onNext={onNext} canGoBack={false} />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jo')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lee')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '2')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft).toMatchObject({
      accountHolderFirstName: 'Jo',
      accountHolderLastName: 'Lee',
      accountHolderDayOfBirth: 1,
      accountHolderMonthOfBirth: 2,
      accountHolderYearOfBirth: 1990,
    })
  })

  it('validates required fields', async () => {
    render(<PersonalInfoStep onNext={vi.fn()} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()
  })
})
