import { describe, it, expect } from 'vitest'
import { resolveLandingRoute } from './landing'

describe('resolveLandingRoute', () => {
  it('returns the authenticated placeholder for now', () => {
    expect(resolveLandingRoute()).toBe('/hello')
  })
})
