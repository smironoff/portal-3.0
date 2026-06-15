import type { AppInfo } from './api/types'

export type FlowSelection =
  | { kind: 'simplified' }
  | { kind: 'general'; jurisdiction: 'AU' }
  | { kind: 'unsupported'; domain?: string }

// Domains that use the simplified two-level flow (slice 1). Extend as jurisdictions land.
// NOTE: this domain-based mapping is a slice-1 simplification of the legacy
// `useSimplifyOnboardingCheck` hook, which also keys off `country.isSimplifyOnboarding`
// and the UAE/SA special-case logic. Revisit when those jurisdictions are ported.
const SIMPLIFIED_DOMAINS = ['TMLC', 'TMBM']

export const selectFlow = (app: Partial<AppInfo>): FlowSelection => {
  const domain = app.portalAccountDomain
  if (domain === 'AU') return { kind: 'general', jurisdiction: 'AU' }
  if (domain && SIMPLIFIED_DOMAINS.includes(domain)) return { kind: 'simplified' }
  if (!domain) return { kind: 'simplified' } // slice-1 dev default
  return { kind: 'unsupported', domain }
}
