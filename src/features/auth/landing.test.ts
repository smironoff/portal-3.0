import { describe, it, expect } from 'vitest'
import { resolveLandingRoute } from './landing'

describe('resolveLandingRoute', () => {
  it('returns the onboarding route', () => {
    expect(resolveLandingRoute()).toBe('/onboarding')
  })
})
