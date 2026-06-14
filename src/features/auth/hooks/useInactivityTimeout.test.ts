import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInactivityTimeout } from './useInactivityTimeout'

describe('useInactivityTimeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls onTimeout after the idle period when enabled', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: true, onTimeout }))
    vi.advanceTimersByTime(61_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled (keep signed in)', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: false, onTimeout }))
    vi.advanceTimersByTime(120_000)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('falls back to 15 minutes when minutes is NaN', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: NaN, enabled: true, onTimeout }))
    vi.advanceTimersByTime(60_000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(16 * 60_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on user activity', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: true, onTimeout }))
    vi.advanceTimersByTime(50_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(50_000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(11_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
