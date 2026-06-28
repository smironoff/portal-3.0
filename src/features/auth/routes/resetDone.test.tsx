import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }
})

describe('ResetDoneScreen', () => {
  it('renders the success copy', async () => {
    const mod = await import('./resetDone')
    const Screen = mod.ResetDoneRoute.options.component as () => React.ReactElement
    render(<Screen />)
    expect(screen.getByRole('heading', { name: /password reset successfully/i })).toBeInTheDocument()
    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })
})
