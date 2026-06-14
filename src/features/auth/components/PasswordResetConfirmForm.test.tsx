import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({ useConfirmPasswordReset: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../hooks/useCaptcha', () => ({ useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }) }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => { mutateAsync.mockReset(); navigate.mockReset() })

describe('PasswordResetConfirmForm', () => {
  it('submits the new password with the token and advances to done', async () => {
    mutateAsync.mockResolvedValue(true)
    const { PasswordResetConfirmForm } = await import('./PasswordResetConfirmForm')
    render(<PasswordResetConfirmForm token="reset-tok" />)
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass123')
    await userEvent.click(screen.getByRole('button', { name: /set|save|reset/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ password: 'NewPass123', token: 'reset-tok', captcha: 'cap' })
    expect(navigate).toHaveBeenCalledWith({ to: '/account/reset/done' })
  })
})
