import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardHeader } from './DashboardHeader'
import { useUIStore } from '@/state/uiStore'

beforeEach(() => {
  useUIStore.getState().setThemeMode('light')
  useUIStore.setState({ sidebarOpen: false })
})

describe('DashboardHeader', () => {
  it('the hamburger toggles the sidebar', async () => {
    render(<DashboardHeader />)
    await userEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('shows a different logo variant in dark mode', () => {
    useUIStore.getState().setThemeMode('light')
    render(<DashboardHeader />)
    const lightSrc = (screen.getByAltText('ThinkMarkets') as HTMLImageElement).src
    cleanup()
    useUIStore.getState().setThemeMode('dark')
    render(<DashboardHeader />)
    const darkSrc = (screen.getByAltText('ThinkMarkets') as HTMLImageElement).src
    expect(darkSrc).not.toBe(lightSrc)
  })
})
