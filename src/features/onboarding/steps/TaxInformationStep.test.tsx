import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { TaxInformationStep } from './TaxInformationStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('TaxInformationStep', () => {
  it('requires a tax id and writes the fields', async () => {
    const onNext = vi.fn()
    render(<TaxInformationStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/tax id is required/i)).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/tax identification number/i), 'TAX123')
    await userEvent.type(screen.getByLabelText(/nationality/i), '826')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft).toMatchObject({
      taxIdentificationNumber: 'TAX123',
      accountHolderIdNumber: 'TAX123',
      accountHolderNationality: 826,
    })
  })
})
