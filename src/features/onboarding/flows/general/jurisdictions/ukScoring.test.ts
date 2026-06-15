import { describe, it, expect } from 'vitest'
import { applyDepositLossGate, computeUkLevel, forexAutoPass } from './ukScoring'

type A = Record<string, { answerLabel?: string; score: number }>
const a = (entries: A): A => entries

describe('applyDepositLossGate', () => {
  it('downgrades PASS to REFER for a non-pass deposit-loss answer', () => {
    expect(applyDepositLossGate('PASS', 'UKDepositLoss3')).toBe('REFER')
  })
  it('leaves PASS for a pass deposit-loss answer or no answer', () => {
    expect(applyDepositLossGate('PASS', 'UKDepositLoss1')).toBe('PASS')
    expect(applyDepositLossGate('PASS', undefined)).toBe('PASS')
  })
  it('never upgrades REFER/FAIL', () => {
    expect(applyDepositLossGate('REFER', 'UKDepositLoss1')).toBe('REFER')
    expect(applyDepositLossGate('FAIL', 'UKDepositLoss1')).toBe('FAIL')
  })
})

describe('forexAutoPass', () => {
  it('returns PASS (gated) for an auto-pass forex answer', () => {
    expect(forexAutoPass(a({ forexExperience: { answerLabel: 'between1and10Trades', score: 0 } }))).toBe('PASS')
  })
  it('returns REFER when auto-pass forex but a non-pass deposit-loss answer', () => {
    expect(forexAutoPass(a({ forexExperience: { answerLabel: 'moreThan60Trades', score: 0 }, UKDepositLoss: { answerLabel: 'UKDepositLoss4', score: 0 } }))).toBe('REFER')
  })
  it('returns undefined when not an auto-pass forex answer', () => {
    expect(forexAutoPass(a({ forexExperience: { answerLabel: 'never', score: 0 } }))).toBeUndefined()
    expect(forexAutoPass(a({}))).toBeUndefined()
  })
})

describe('computeUkLevel (no-forex scored path)', () => {
  it('with shares experience: REFER when personalProfit+useLeverage > 0, else FAIL', () => {
    const base = { forexExperience: { answerLabel: 'never', score: 0 }, sharesFundsExperience: { answerLabel: 'lessThan10Trades', score: 0 } }
    expect(computeUkLevel(a({ ...base, personalProfit: { answerLabel: 'x', score: 1 }, useLeverage: { answerLabel: 'y', score: 0 } }))).toBe('REFER')
    expect(computeUkLevel(a({ ...base, personalProfit: { answerLabel: 'x', score: 0 }, useLeverage: { answerLabel: 'y', score: 0 } }))).toBe('FAIL')
  })
  it('without shares experience: REFER when the 4-question sum > 1, else FAIL', () => {
    const base = { forexExperience: { answerLabel: 'never', score: 0 }, sharesFundsExperience: { answerLabel: 'none', score: 0 } }
    expect(computeUkLevel(a({ ...base, personalProfit: { answerLabel: 'x', score: 1 }, useLeverage: { answerLabel: 'y', score: 1 } }))).toBe('REFER')
    expect(computeUkLevel(a({ ...base, personalProfit: { answerLabel: 'x', score: 1 }, useLeverage: { answerLabel: 'y', score: 0 } }))).toBe('FAIL')
  })
  it('auto-pass forex answer returns PASS (gated)', () => {
    expect(computeUkLevel(a({ forexExperience: { answerLabel: 'moreThan60Trades', score: 0 } }))).toBe('PASS')
    expect(computeUkLevel(a({ forexExperience: { answerLabel: 'moreThan60Trades', score: 0 }, UKDepositLoss: { answerLabel: 'UKDepositLoss5', score: 0 } }))).toBe('REFER')
  })
  it('defaults to FAIL on missing/unknown forex answer', () => {
    expect(computeUkLevel(a({}))).toBe('FAIL')
  })
})
