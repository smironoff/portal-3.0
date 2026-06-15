import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const sendMutate = vi.fn()
const verifyMutateAsync = vi.fn()
const profile = { id: 1, firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', country: { id: 1 } }

const isUserVerifiedData = vi.hoisted(() => ({ value: false as boolean | undefined, isLoading: false }))

vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: profile }) }))
vi.mock('./api/emailQueries', () => ({
  useSendOtp: () => ({ mutate: sendMutate, isPending: false, isError: false, data: undefined }),
  useVerifyOtp: () => ({ mutateAsync: verifyMutateAsync }),
  useIsUserVerified: () => ({ data: isUserVerifiedData.value, isLoading: isUserVerifiedData.isLoading }),
}))

beforeEach(() => {
  sendMutate.mockReset()
  verifyMutateAsync.mockReset()
  isUserVerifiedData.value = false
  isUserVerifiedData.isLoading = false
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

  it('shows verified confirmation and does not send OTP when email is already verified', async () => {
    isUserVerifiedData.value = true
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument()
    expect(sendMutate).not.toHaveBeenCalled()
  })

  it('sends OTP when verified-check has settled with an error (data: undefined, isLoading: false)', async () => {
    isUserVerifiedData.value = undefined
    isUserVerifiedData.isLoading = false
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    expect(sendMutate).toHaveBeenCalledWith({
      originCountry: 1, accountHolderFirstName: 'Ann', accountHolderLastName: 'Lee',
      preferredLanguage: 1, accountHolderEmail: 'a@b.com',
    })
  })

  it('does not send OTP while the verified-check is still loading', async () => {
    isUserVerifiedData.value = undefined
    isUserVerifiedData.isLoading = true
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    expect(sendMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
