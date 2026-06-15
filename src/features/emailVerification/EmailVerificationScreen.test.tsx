import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const sendMutate = vi.fn()
const verifyMutateAsync = vi.fn()
const profile = { id: 1, firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', country: { id: 1 } }

vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: profile }) }))
vi.mock('./api/emailQueries', () => ({
  useSendOtp: () => ({ mutate: sendMutate, isPending: false, isError: false, data: undefined }),
  useVerifyOtp: () => ({ mutateAsync: verifyMutateAsync }),
}))

beforeEach(() => {
  sendMutate.mockReset()
  verifyMutateAsync.mockReset()
})

describe('EmailVerificationScreen', () => {
  it('sends the OTP on mount with the profile fields', async () => {
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    expect(sendMutate).toHaveBeenCalledWith({
      originCountry: 1, accountHolderFirstName: 'Ann', accountHolderLastName: 'Lee',
      preferredLanguage: 1, accountHolderEmail: 'a@b.com',
    })
  })

  it('shows a confirmation after a successful verification', async () => {
    verifyMutateAsync.mockResolvedValue(true)
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    for (let i = 1; i <= 6; i++) await userEvent.type(screen.getByLabelText(`Digit ${i}`), String(i))
    expect(verifyMutateAsync).toHaveBeenCalledWith({ otp: '123456', email: 'a@b.com' })
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument()
  })
})
