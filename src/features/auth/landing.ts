import type { UserProfile } from '@/api/types'

// SEAM: later verticals replace the body with status-based routing
// (approved -> dashboard, incomplete -> onboarding, pending -> pending screen).
// For 2a it always lands on the authenticated placeholder.
export const resolveLandingRoute = (_profile?: UserProfile): string => {
  return '/hello'
}
