import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = { auth: vi.fn(), tfbo: vi.fn(), request: vi.fn() }
vi.mock('@/api/client', () => ({ getHttpClient: () => http }))

beforeEach(() => {
  http.auth.mockReset()
  http.tfbo.mockReset()
})

describe('authApi', () => {
  it('login posts credentials to auth/login unauthenticated', async () => {
    http.auth.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a' } })
    const { login } = await import('./authApi')
    const res = await login('a@b.com', 'pw', 'captcha-token')
    expect(http.auth).toHaveBeenCalledWith(
      'auth/login',
      'post',
      { email: 'a@b.com', password: 'pw', recaptchaResponse: 'captcha-token' },
      1
    )
    expect(res.status).toBe('OK')
  })

  it('verifyTwoFactor posts code to auth/tfa authenticated', async () => {
    http.auth.mockResolvedValue({ status: 'OK' })
    const { verifyTwoFactor } = await import('./authApi')
    await verifyTwoFactor('a@b.com', '123456')
    expect(http.auth).toHaveBeenCalledWith('auth/tfa', 'post', { email: 'a@b.com', code: '123456' }, 0)
  })

  it('requestPasswordReset sends the TFBO forgot_password_web envelope', async () => {
    http.tfbo.mockResolvedValue({ payload: [{ result: { password_reset: 'OK' } }] })
    const { requestPasswordReset } = await import('./authApi')
    const ok = await requestPasswordReset('a@b.com', 'cap')
    expect(http.tfbo).toHaveBeenCalledWith(
      { payload: [{ module: 'authentication', action: 'forgot_password_web', email_id: 'a@b.com', response: 'cap' }] },
      1
    )
    expect(ok).toBe(true)
  })

  it('confirmPasswordReset sends password + token and returns true on OK', async () => {
    http.tfbo.mockResolvedValue({ payload: [{ result: { password_reset: 'OK' } }] })
    const { confirmPasswordReset } = await import('./authApi')
    const ok = await confirmPasswordReset('NewPass123', 'tok', 'cap')
    expect(http.tfbo).toHaveBeenCalledWith(
      { payload: [{ module: 'authentication', action: 'forgot_password_web', password: 'NewPass123', password_reset_token: 'tok', response: 'cap' }] },
      1
    )
    expect(ok).toBe(true)
  })

  it('getUserProfile reads payload[0].result', async () => {
    http.tfbo.mockResolvedValue({ payload: [{ result: { id: 1, email: 'a@b.com' } }] })
    const { getUserProfile } = await import('./authApi')
    const p = await getUserProfile()
    expect(p.email).toBe('a@b.com')
  })
})
