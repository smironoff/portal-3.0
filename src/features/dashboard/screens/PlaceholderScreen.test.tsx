import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaceholderScreen } from './PlaceholderScreen'

describe('PlaceholderScreen', () => {
  it('renders the section title as a heading and a coming-soon note', () => {
    render(<PlaceholderScreen title="Funds" />)
    expect(screen.getByRole('heading', { name: 'Funds' })).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
