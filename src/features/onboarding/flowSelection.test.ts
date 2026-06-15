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
    expect(selectFlow({ portalAccountDomain: 'UK' })).toEqual({ kind: 'unsupported', domain: 'UK' })
  })
  it('routes TMCY and TMEU to general TMCY', () => {
    expect(selectFlow({ portalAccountDomain: 'TMCY' })).toEqual({ kind: 'general', jurisdiction: 'TMCY' })
    expect(selectFlow({ portalAccountDomain: 'TMEU' })).toEqual({ kind: 'general', jurisdiction: 'TMCY' })
  })
})
