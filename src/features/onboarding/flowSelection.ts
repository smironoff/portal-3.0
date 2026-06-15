import type { AppInfo } from './api/types'

export type FlowSelection =
  | { kind: 'simplified' }
  | { kind: 'general'; jurisdiction: 'AU' | 'TMCY' | 'UK' }
  | { kind: 'unsupported'; domain?: string }

// Domains that use the simplified two-level flow (slice 1). Extend as jurisdictions land.
// NOTE: the domain-based mapping below is supplemented by country-driven logic (the optional
// `country` param), which mirrors the legacy `useSimplifyOnboardingCheck` hook behaviour for
// UAE/SA special-casing and `country.isSimplifyOnboarding`. When a country is supplied its
// rules are evaluated first; the domain branches act as the fallback.
const SIMPLIFIED_DOMAINS = ['TMLC', 'TMBM']

export const selectFlow = (
  app: Partial<AppInfo>,
  country?: { code3: string; isSimplifyOnboarding?: boolean }
): FlowSelection => {
  const domain = app.portalAccountDomain
  if (country) {
    const isUaeOrSa = country.code3 === 'ARE' || country.code3 === 'ZAF'
    if (isUaeOrSa) {
      if (domain === 'TMLC') return { kind: 'simplified' }
      // else: legacy treats UAE/SA non-TMLC as NOT simplified -> fall through to domain routing
    } else if (country.isSimplifyOnboarding && app.platformAccountType !== 'Money_Manager') {
      return { kind: 'simplified' }
    }
  }
  // IB-`simplified`-flow edge case (legacy checkForSimplifiedOnboarding) is deferred with the IB system.
  if (domain === 'AU') return { kind: 'general', jurisdiction: 'AU' }
  if (domain === 'TMCY' || domain === 'TMEU') return { kind: 'general', jurisdiction: 'TMCY' }
  if (domain === 'UK') return { kind: 'general', jurisdiction: 'UK' }
  if (domain && SIMPLIFIED_DOMAINS.includes(domain)) return { kind: 'simplified' }
  if (!domain) return { kind: 'simplified' } // slice-1 dev default
  return { kind: 'unsupported', domain }
}
