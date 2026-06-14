import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({ useLogin: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../hooks/useCaptcha', () => ({ useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => { mutateAsync.mockReset(); navigate.mockReset() })

describe('LoginForm', () => {
  it('validates required fields', async () => {
    const { LoginForm } = await import('./LoginForm')
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('submits credentials with a captcha token', async () => {
    mutateAsync.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' } })
    const { LoginForm } = await import('./LoginForm')
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1', captcha: 'cap' })
  })
})
