import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.setConfig({ testTimeout: 20000 })

const navigate = vi.fn()
const logout = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}))
vi.mock('../useLogout', () => ({ useLogout: () => logout }))

beforeEach(() => {
  navigate.mockReset()
  logout.mockReset()
})

describe('DashboardSidebar', () => {
  it('renders the Core five and a logout action', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    for (const label of ['Accounts', 'Funds', 'Downloads', 'Tools', 'Support']) {
      // permanent + temporary drawers both render the list, so each label appears twice
      expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByRole('button', { name: /log out/i }).length).toBeGreaterThan(0)
  })

  it('navigates when a nav item is clicked', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Funds' })[0]!)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard/funds' })
  })

  it('invokes logout when the logout action is clicked', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    await userEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]!)
    expect(logout).toHaveBeenCalled()
  })
})
