import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({ useRequestPasswordReset: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../hooks/useCaptcha', () => ({ useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => { mutateAsync.mockReset(); navigate.mockReset() })

describe('PasswordResetRequestForm', () => {
  it('requests a reset and advances to the sent screen', async () => {
    mutateAsync.mockResolvedValue(true)
    const { PasswordResetRequestForm } = await import('./PasswordResetRequestForm')
    render(<PasswordResetRequestForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /reset|send/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', captcha: 'cap' })
    expect(navigate).toHaveBeenCalledWith({ to: '/account/reset/sent', search: { email: 'a@b.com' } })
  })
})
