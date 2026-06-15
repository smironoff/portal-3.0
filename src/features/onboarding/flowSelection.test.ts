import { describe, it, expect } from 'vitest'
import { selectFlow } from './flowSelection'

describe('selectFlow', () => {
  it('routes AU to general', () => {
    expect(selectFlow({ portalAccountDomain: 'AU' })).toEqual({ kind: 'general', jurisdiction: 'AU' })
  })
  it('routes a simplified domain to simplified', () => {
    expect(selectFlow({ portalAccountDomain: 'TMLC' })).toEqual({ kind: 'simplified' })
  })
  it('defaults to simplified when no domain (slice-1 dev behaviour)', () => {
    expect(selectFlow({})).toEqual({ kind: 'simplified' })
  })
  it('routes unsupported domains to not-available', () => {
    expect(selectFlow({ portalAccountDomain: 'UNKNOWN' })).toEqual({ kind: 'unsupported', domain: 'UNKNOWN' })
  })
  it('routes UK to general UK', () => {
    expect(selectFlow({ portalAccountDomain: 'UK' })).toEqual({ kind: 'general', jurisdiction: 'UK' })
  })
  it('routes TMCY and TMEU to general TMCY', () => {
    expect(selectFlow({ portalAccountDomain: 'TMCY' })).toEqual({ kind: 'general', jurisdiction: 'TMCY' })
    expect(selectFlow({ portalAccountDomain: 'TMEU' })).toEqual({ kind: 'general', jurisdiction: 'TMCY' })
  })
  it('UAE country is simplified only when the domain is TMLC', () => {
    const uae = { code3: 'ARE', isSimplifyOnboarding: false }
    expect(selectFlow({ portalAccountDomain: 'TMLC' }, uae)).toEqual({ kind: 'simplified' })
    expect(selectFlow({ portalAccountDomain: 'UK' }, uae)).toEqual({ kind: 'general', jurisdiction: 'UK' })
  })
  it('South Africa country is simplified only when the domain is TMLC', () => {
    const sa = { code3: 'ZAF', isSimplifyOnboarding: false }
    expect(selectFlow({ portalAccountDomain: 'TMLC' }, sa)).toEqual({ kind: 'simplified' })
  })
  it('isSimplifyOnboarding country routes to simplified except for Money_Manager', () => {
    const c = { code3: 'XYZ', isSimplifyOnboarding: true }
    expect(selectFlow({ portalAccountDomain: 'AU' }, c)).toEqual({ kind: 'simplified' })
    expect(selectFlow({ portalAccountDomain: 'AU', platformAccountType: 'Money_Manager' }, c)).toEqual({ kind: 'general', jurisdiction: 'AU' })
  })
  it('falls back to domain routing when no country is supplied', () => {
    expect(selectFlow({ portalAccountDomain: 'AU' })).toEqual({ kind: 'general', jurisdiction: 'AU' })
    expect(selectFlow({ portalAccountDomain: 'TMLC' })).toEqual({ kind: 'simplified' })
  })
})
