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
})
