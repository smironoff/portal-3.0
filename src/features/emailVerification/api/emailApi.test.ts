import { describe, it, expect, vi, beforeEach } from 'vitest'

const tfboCall = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))

beforeEach(() => tfboCall.mockReset())

const params = {
  originCountry: 1, accountHolderFirstName: 'A', accountHolderLastName: 'B',
  preferredLanguage: 1, accountHolderEmail: 'a@b.com',
}

describe('email verification api', () => {
  it('sends the OTP via emailvalidation/send_verification_code authenticated', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { sendOtpCode } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await sendOtpCode(params)).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'send_verification_code', params, Authorize.Yes)
  })

  it('verifies the OTP via emailvalidation/verify_otp_code', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { verifyOtpCode } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await verifyOtpCode('123456', 'a@b.com')).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'verify_otp_code', { otpValue: '123456', accountHolderEmail: 'a@b.com' }, Authorize.Yes)
  })

  it('returns false when verification status is not OK', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'VALIDATION_ERROR' }] })
    const { verifyOtpCode } = await import('./emailApi')
    expect(await verifyOtpCode('000000', 'a@b.com')).toBe(false)
  })

  it('isUserVerified calls emailvalidation/isuserverified and coerces the boolean', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { isUserVerified } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await isUserVerified('a@b.com')).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'isuserverified', { userEmail: 'a@b.com' }, Authorize.No)
  })

  it('isEmailVerificationRequired calls isemail_verification_required with originCountry', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: false }] })
    const { isEmailVerificationRequired } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await isEmailVerificationRequired(7)).toBe(false)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'isemail_verification_required', { originCountry: 7 }, Authorize.No)
  })

  it('status helpers return false on a non-OK / empty payload', async () => {
    tfboCall.mockResolvedValue({ payload: [] })
    const { isUserVerified, isEmailVerificationRequired } = await import('./emailApi')
    expect(await isUserVerified('a@b.com')).toBe(false)
    expect(await isEmailVerificationRequired(7)).toBe(false)
  })
})
