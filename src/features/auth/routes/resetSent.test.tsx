import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }
})

describe('ResetSentScreen', () => {
  it('renders the check-your-email copy with the address', async () => {
    const mod = await import('./resetSent')
    const Screen = mod.ResetSentRoute.options.component as () => React.ReactElement
    // stub the route search to supply the email
    vi.spyOn(mod.ResetSentRoute, 'useSearch').mockReturnValue({ email: 'a@b.com' } as never)
    render(<Screen />)
    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(screen.getByText(/a@b.com/)).toBeInTheDocument()
    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })
})
