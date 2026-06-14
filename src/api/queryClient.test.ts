import { describe, it, expect } from 'vitest'
import { createQueryClient, registerTokenExpiredHandler } from './queryClient'

describe('createQueryClient', () => {
  it('configures sane defaults (no refetch on window focus, one retry)', () => {
    const qc = createQueryClient()
    const defaults = qc.getDefaultOptions()
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
    expect(defaults.queries?.retry).toBe(1)
  })
})

describe('registerTokenExpiredHandler', () => {
  it('runs the teardown callback on TokenExpired and unregisters cleanly', () => {
    const qc = createQueryClient()
    let calls = 0
    const off = registerTokenExpiredHandler(qc, () => { calls++ })
    window.dispatchEvent(new CustomEvent('TokenExpired', { detail: { source: 'authClient' } }))
    expect(calls).toBe(1)
    off()
    window.dispatchEvent(new CustomEvent('TokenExpired', { detail: { source: 'authClient' } }))
    expect(calls).toBe(1)
  })

  it('ignores a plain TokenExpired event without the authClient source marker', () => {
    const qc = createQueryClient()
    let calls = 0
    const off = registerTokenExpiredHandler(qc, () => { calls++ })
    window.dispatchEvent(new Event('TokenExpired'))
    expect(calls).toBe(0)
    off()
  })
})
