import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'
import { useUIStore } from '@/state/uiStore'

beforeEach(() => useUIStore.getState().setThemeMode('light'))

describe('ThemeToggle', () => {
  it('toggles theme mode from light to dark', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(useUIStore.getState().themeMode).toBe('dark')
  })

  it('toggles back from dark to light', async () => {
    useUIStore.getState().setThemeMode('dark')
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(useUIStore.getState().themeMode).toBe('light')
  })
})
