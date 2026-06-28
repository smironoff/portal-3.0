import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { initiateSocialLogin } = vi.hoisted(() => ({
  initiateSocialLogin: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./initiateSocialLogin', () => ({ initiateSocialLogin }))

import { SocialButtonsSection } from './SocialButtonsSection'

describe('SocialButtonsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a Google and an Apple button', () => {
    render(<SocialButtonsSection />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument()
  })

  it('initiates the chosen provider on click', async () => {
    render(<SocialButtonsSection />)
    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }))
    expect(initiateSocialLogin).toHaveBeenCalledWith('apple')
  })
})
