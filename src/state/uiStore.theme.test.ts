import { describe, it, expect, beforeEach, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './uiStore'

// matchMedia is not implemented in jsdom; stub it per test to simulate the OS
// preference. Omit the stub to simulate matchMedia being unavailable.
const stubPrefersDark = (prefersDark: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('uiStore theme initialization', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses the persisted choice over the OS preference', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    stubPrefersDark(false) // OS prefers light
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().themeMode).toBe('dark')
  })

  it('falls back to the OS preference when nothing is persisted', async () => {
    stubPrefersDark(true)
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().themeMode).toBe('dark')
  })

  it('defaults to light when nothing is persisted and the OS prefers light', async () => {
    stubPrefersDark(false)
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().themeMode).toBe('light')
  })

  it('defaults to light when matchMedia is unavailable', async () => {
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().themeMode).toBe('light')
  })

  it('persists an explicit setThemeMode choice', async () => {
    stubPrefersDark(false)
    const { useUIStore } = await import('./uiStore')
    useUIStore.getState().setThemeMode('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
