import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({
  useVerifyTwoFactor: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
})

describe('TwoFactorForm', () => {
  it('submits the code and lands on success', async () => {
    mutateAsync.mockResolvedValue({
      status: 'OK',
      tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' },
    })
    const { TwoFactorForm } = await import('./TwoFactorForm')
    render(<TwoFactorForm email="a@b.com" />)
    await userEvent.type(screen.getByLabelText(/code/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', code: '123456' })
  })

  it('shows an inline error on an invalid code', async () => {
    mutateAsync.mockResolvedValue({ code: 'ASE-XXX' })
    const { TwoFactorForm } = await import('./TwoFactorForm')
    render(<TwoFactorForm email="a@b.com" />)
    await userEvent.type(screen.getByLabelText(/code/i), '000000')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByText(/invalid code/i)).toBeInTheDocument()
  })
})
