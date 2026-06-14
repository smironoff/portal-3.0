import { describe, it, expect } from 'vitest'
import { aseCodeToMessageKey } from './aseCodes'

describe('aseCodeToMessageKey', () => {
  it('maps known codes', () => {
    expect(aseCodeToMessageKey('ASE-001')).toBe('auth.error.invalidCredentials')
    expect(aseCodeToMessageKey('ASE-002')).toBe('auth.error.tfaExpired')
  })
  it('falls back to a generic key for unknown codes', () => {
    expect(aseCodeToMessageKey('ASE-999')).toBe('auth.error.generic')
    expect(aseCodeToMessageKey(undefined)).toBe('auth.error.generic')
  })
})
