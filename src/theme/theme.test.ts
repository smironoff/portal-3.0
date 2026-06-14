import { describe, it, expect } from 'vitest'
import { createAppTheme } from './theme'

describe('createAppTheme', () => {
  it('maps dark tokens into the palette', () => {
    const t = createAppTheme('dark', 'default')
    expect(t.palette.mode).toBe('dark')
    expect(t.palette.background.default).toBe('#0e161c')
  })

  it('uses legacy breakpoints', () => {
    const t = createAppTheme('light', 'default')
    expect(t.breakpoints.values.sm).toBe(600)
    expect(t.breakpoints.values.lg).toBe(1024)
  })
})
